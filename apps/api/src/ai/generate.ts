import { z } from 'zod'

import { errorFields, type Logger } from '../log.ts'
import { aiConfig, type AiFeature } from './config.ts'
import type { AiContent, AiMessage, AiProvider, AiResponse, AiUsage } from './provider.ts'
import type { UsageKey, UsageStore } from './usage.ts'

// The logged result of one call (docs/ai.md, "Rules").
export type AiOutcome =
  'ok' | 'retried' | 'invalid' | 'refused' | 'timeout' | 'capped' | 'provider_error'

export type AiResult<T> =
  | { ok: true; value: T; outcome: 'ok' | 'retried'; model: string; promptVersion: number }
  | { ok: false; outcome: Exclude<AiOutcome, 'ok' | 'retried'> }

export interface GenerateRequest<T> {
  feature: AiFeature
  // From the verified token, never from the request body or the model.
  userId: string
  // The request's logger, which carries its request ID.
  log: Logger
  system: string
  content: readonly AiContent[]
  schema: z.ZodType<T>
}

interface AiDeps {
  provider: AiProvider
  usage: UsageStore
  now?: () => Date
}

const noUsage: AiUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
}

function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  }
}

// A reply's JSON checked against the schema: the value, or the issue paths and
// a message for the retry. The reply's text itself is never logged.
function parseReply<T>(
  schema: z.ZodType<T>,
  text: string,
): { ok: true; value: T } | { ok: false; paths: string; message: string } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, paths: '(not JSON)', message: 'The reply was not valid JSON.' }
  }
  const result = schema.safeParse(json)
  if (result.success) return { ok: true, value: result.data }
  return {
    ok: false,
    paths: result.error.issues.map((issue) => issue.path.join('.') || '(root)').join(','),
    message: z.prettifyError(result.error),
  }
}

// One structured call to a model: checks the user's daily cap, calls the
// provider with a timeout, validates the reply with Zod and retries once with
// the validation error. Writes one log line per call (docs/ai.md).
export function createAi({ provider, usage, now = () => new Date() }: AiDeps) {
  return async function generate<T>(request: GenerateRequest<T>): Promise<AiResult<T>> {
    const config = aiConfig.features[request.feature]
    const start = performance.now()
    let tokens = noUsage
    let stopReason: AiResponse['stopReason'] | null = null
    let issuePaths: string | null = null

    const finish = <R extends AiResult<T>>(result: R, error?: unknown): R => {
      request.log.info('ai call', {
        feature: request.feature,
        provider: provider.name,
        model: config.model,
        promptVersion: config.promptVersion,
        outcome: result.outcome,
        latencyMs: Math.round(performance.now() - start),
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        cacheReadTokens: tokens.cacheReadTokens,
        cacheWriteTokens: tokens.cacheWriteTokens,
        stopReason,
        issuePaths,
        ...(error === undefined ? {} : errorFields(error)),
      })
      return result
    }

    // The UTC date on purpose: see `aiUsage` in db/schema.ts.
    const key: UsageKey = {
      userId: request.userId,
      feature: request.feature,
      day: now().toISOString().slice(0, 10),
    }
    if (!(await usage.reserve(key, config.dailyCap)))
      return finish({ ok: false, outcome: 'capped' })

    const jsonSchema = z.toJSONSchema(request.schema)
    const messages: AiMessage[] = [{ role: 'user', content: request.content }]
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        // A timer rather than AbortSignal.timeout, so tests can advance it.
        const controller = new AbortController()
        const timer = setTimeout(() => {
          controller.abort()
        }, config.timeoutMs)
        const signal = controller.signal
        let response: AiResponse
        try {
          response = await provider.generate({
            model: config.model,
            effort: config.effort,
            maxTokens: config.maxTokens,
            system: request.system,
            messages,
            jsonSchema,
            signal,
          })
        } catch (error) {
          if (signal.aborted) return finish({ ok: false, outcome: 'timeout' })
          return finish({ ok: false, outcome: 'provider_error' }, error)
        } finally {
          clearTimeout(timer)
        }
        tokens = addUsage(tokens, response.usage)
        stopReason = response.stopReason
        if (response.stopReason === 'refusal') return finish({ ok: false, outcome: 'refused' })
        // A cut-off reply would be cut off again; it is not retried.
        if (response.stopReason !== 'end_turn') return finish({ ok: false, outcome: 'invalid' })

        const parsed = parseReply(request.schema, response.text)
        if (parsed.ok) {
          return finish({
            ok: true,
            value: parsed.value,
            outcome: attempt === 0 ? 'ok' : 'retried',
            model: config.model,
            promptVersion: config.promptVersion,
          })
        }
        issuePaths = parsed.paths
        messages.push(
          { role: 'assistant', content: [{ type: 'text', text: response.text }] },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `The reply did not match the schema:\n${parsed.message}\nAnswer again.`,
              },
            ],
          },
        )
      }
      return finish({ ok: false, outcome: 'invalid' })
    } finally {
      await usage.addTokens(key, tokens)
    }
  }
}
