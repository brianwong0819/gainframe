import { type FoodEstimateRequest, type FoodTableEntry, resolveEstimate } from '@gainframe/shared'
import { FOOD_TABLE } from '@gainframe/shared/food-table'

import { createAi } from '../../src/ai/generate.ts'
import type { AiContent, AiProvider, AiUsage } from '../../src/ai/provider.ts'
import {
  estimateReplySchema,
  TEXT_MEAL_SYSTEM,
  textMealReplyCheckedSchema,
  textMealRequest,
  visionPromptFor,
} from '../../src/food/estimate.ts'
import type { Logger } from '../../src/log.ts'
import type { EvalCase } from './labels.ts'
import { type CaseRuns, type ReportRow, type RunResult, summarize, type Truth } from './metrics.ts'
import { callCost } from './prices.ts'

const ENTRIES: ReadonlyMap<string, FoodTableEntry> = new Map(
  FOOD_TABLE.map((entry) => [entry.id, entry]),
)

/**
 * The no-AI baseline: each of the meal's foods at its table entry's default
 * serving. Throws on an id that is not in the table, which is a labelling error.
 */
export function baselineTotals(entryIds: readonly string[]): Truth {
  return entryIds.reduce(
    (sum, id) => {
      const entry = ENTRIES.get(id)
      if (entry === undefined) throw new Error(`Unknown food table id in labels: ${id}`)
      return {
        proteinG: sum.proteinG + (entry.proteinPer100G * entry.servingG) / 100,
        kcal: sum.kcal + (entry.kcalPer100G * entry.servingG) / 100,
      }
    },
    { proteinG: 0, kcal: 0 },
  )
}

// The API's AI pipeline for one model: the same schema checks, timeout and
// one retry as in production, with no daily cap, and the tokens of the call
// that just finished (the pipeline reports them through its usage store).
interface EvalAi {
  generate: ReturnType<typeof createAi>
  lastTokens: () => AiUsage
}

function evalAi(provider: AiProvider, model: string): EvalAi {
  let last: AiUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
  const generate = createAi({
    provider: {
      name: provider.name,
      generate: (request) => provider.generate({ ...request, model }),
    },
    usage: {
      reserve: () => Promise.resolve(true),
      addTokens: (_key, usage) => {
        last = usage
        return Promise.resolve()
      },
    },
  })
  return { generate, lastTokens: () => last }
}

export interface EvalOptions {
  cases: readonly EvalCase[]
  readPhoto: (file: string) => Promise<FoodEstimateRequest['photo']>
  provider: AiProvider
  models: readonly string[]
  promptVersions: readonly number[]
  runs: number
  log: Logger
}

const truthOf = (item: EvalCase): Truth => ({ proteinG: item.proteinG, kcal: item.kcal })

async function runOnce(
  ai: EvalAi,
  model: string,
  request: {
    system: string
    content: readonly AiContent[]
    text: boolean
  },
  log: Logger,
): Promise<RunResult> {
  const common = { userId: 'eval', log, system: request.system, content: request.content }
  const result = request.text
    ? await ai.generate({ ...common, feature: 'textMeal', schema: textMealReplyCheckedSchema })
    : await ai.generate({ ...common, feature: 'vision', schema: estimateReplySchema })
  if (!result.ok) return { ok: false, outcome: result.outcome }
  const items = resolveEstimate(result.value, ENTRIES)
  return {
    ok: true,
    proteinG: items.reduce((sum, item) => sum + item.proteinG, 0),
    kcal: items.reduce((sum, item) => sum + item.kcal, 0),
    costUsd: callCost(model, ai.lastTokens()),
  }
}

/**
 * Runs every case `runs` times per model and photo prompt version, and the
 * text set (cases with a description) once per model with the served text
 * prompt, then the baseline. Calls run one at a time, so the daily cost is
 * predictable and a throttled account is not hit harder.
 */
export async function evaluate(options: EvalOptions): Promise<ReportRow[]> {
  const rows: ReportRow[] = []
  const repeat = async (
    ai: EvalAi,
    model: string,
    build: (item: EvalCase) => Promise<{
      system: string
      content: readonly AiContent[]
      text: boolean
    }>,
    cases: readonly EvalCase[],
  ) => {
    const results: CaseRuns[] = []
    for (const item of cases) {
      const request = await build(item)
      const runs: RunResult[] = []
      for (let run = 0; run < options.runs; run++) {
        runs.push(await runOnce(ai, model, request, options.log))
      }
      results.push({ caseId: item.id, truth: truthOf(item), runs })
    }
    return summarize(results)
  }

  for (const model of options.models) {
    const ai = evalAi(options.provider, model)
    for (const version of options.promptVersions) {
      const prompt = visionPromptFor(version)
      const summary = await repeat(
        ai,
        model,
        async (item) => {
          const photo = await options.readPhoto(item.photo)
          return {
            system: prompt.system,
            content: [
              { type: 'image', mediaType: photo.type, data: photo.base64 },
              { type: 'text', text: prompt.request },
            ],
            text: false,
          }
        },
        options.cases,
      )
      rows.push({ label: `Photo · ${model} · vision v${String(version)}`, summary })
    }
    const described = options.cases.filter((item) => item.description !== undefined)
    if (described.length > 0) {
      const summary = await repeat(
        ai,
        model,
        (item) =>
          Promise.resolve({
            system: TEXT_MEAL_SYSTEM,
            content: [
              {
                type: 'text',
                text: textMealRequest(
                  { text: item.description ?? '', locale: item.locale, answers: [] },
                  [],
                ),
              },
            ],
            text: true,
          }),
        described,
      )
      rows.push({ label: `Text · ${model}`, summary })
    }
  }

  const baseline = summarize(
    options.cases.map((item) => ({
      caseId: item.id,
      truth: truthOf(item),
      runs: [{ ok: true, ...baselineTotals(item.entryIds), costUsd: null }],
    })),
  )
  rows.push({ label: 'Baseline · default servings, no AI', summary: baseline })
  return rows
}
