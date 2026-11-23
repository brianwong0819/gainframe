import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { createLogger } from '../log.ts'
import { aiConfig } from './config.ts'
import { fakeProvider, type FakeStep, reply } from './fake.ts'
import { createAi } from './generate.ts'
import type { UsageKey, UsageStore } from './usage.ts'

const schema = z.object({ name: z.string(), grams: z.number().positive() })
const NOW = new Date('2026-11-23T20:00:00.000Z')

// An in-memory stand-in for `usageStore`, with the same counting rule.
function memoryUsage(callsSoFar = 0) {
  const rows = new Map<string, { calls: number; inputTokens: number; outputTokens: number }>()
  const id = (key: UsageKey) => `${key.userId}|${key.day}|${key.feature}`
  const store: UsageStore = {
    reserve: (key, cap) => {
      const row = rows.get(id(key)) ?? { calls: callsSoFar, inputTokens: 0, outputTokens: 0 }
      if (row.calls >= cap) return Promise.resolve(false)
      rows.set(id(key), { ...row, calls: row.calls + 1 })
      return Promise.resolve(true)
    },
    addTokens: (key, usage) => {
      const row = rows.get(id(key))
      if (row !== undefined) {
        row.inputTokens += usage.inputTokens
        row.outputTokens += usage.outputTokens
      }
      return Promise.resolve()
    },
  }
  return { store, rows }
}

async function run(steps: FakeStep[], callsSoFar = 0) {
  const lines: Record<string, unknown>[] = []
  const log = createLogger({
    release: 'test',
    write: (line) => lines.push(JSON.parse(line) as Record<string, unknown>),
  }).child({ requestId: 'req-1' })
  const provider = fakeProvider(steps)
  const usage = memoryUsage(callsSoFar)
  const generate = createAi({ provider, usage: usage.store, now: () => NOW })
  const result = await generate({
    feature: 'vision',
    userId: 'user-a',
    log,
    system: 'Estimate the food.',
    content: [{ type: 'text', text: 'chicken rice' }],
    schema,
  })
  return { result, lines, requests: provider.requests, rows: usage.rows }
}

const valid = JSON.stringify({ name: 'chicken rice', grams: 350 })

describe('createAi', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the validated value and logs one ok line with model, prompt version and tokens', async () => {
    const { result, lines, requests, rows } = await run([reply(valid)])
    expect(result).toEqual({
      ok: true,
      value: { name: 'chicken rice', grams: 350 },
      outcome: 'ok',
      model: 'anthropic.claude-haiku-5-5',
      promptVersion: 1,
    })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      level: 'info',
      msg: 'ai call',
      requestId: 'req-1',
      feature: 'vision',
      provider: 'fake',
      model: 'anthropic.claude-haiku-5-5',
      promptVersion: 1,
      outcome: 'ok',
      inputTokens: 100,
      outputTokens: 20,
      issuePaths: null,
    })
    expect(requests[0]?.effort).toBe('low')
    expect(requests[0]?.jsonSchema).toMatchObject({ type: 'object', required: ['name', 'grams'] })
    expect(rows.get('user-a|2026-11-23|vision')).toEqual({
      calls: 1,
      inputTokens: 100,
      outputTokens: 20,
    })
  })

  it('retries once with the validation error and logs retried with both attempts’ tokens', async () => {
    const bad = JSON.stringify({ name: 'chicken rice', grams: -1 })
    const { result, lines, requests } = await run([reply(bad), reply(valid)])
    expect(result).toMatchObject({ ok: true, outcome: 'retried' })
    expect(requests).toHaveLength(2)
    const retry = requests[1]?.messages ?? []
    expect(retry.map((message) => message.role)).toEqual(['user', 'assistant', 'user'])
    expect(JSON.stringify(retry[2])).toContain('grams')
    expect(lines[0]).toMatchObject({ outcome: 'retried', inputTokens: 200, issuePaths: 'grams' })
  })

  it('gives up after a second invalid reply and logs only the issue paths', async () => {
    const { result, lines } = await run([reply('not json'), reply('{"name":1}')])
    expect(result).toEqual({ ok: false, outcome: 'invalid' })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ outcome: 'invalid', issuePaths: 'name,grams' })
    expect(JSON.stringify(lines[0])).not.toContain('chicken')
  })

  it('treats a refusal as an outcome and does not retry it', async () => {
    const { result, lines, requests } = await run([reply('', 'refusal')])
    expect(result).toEqual({ ok: false, outcome: 'refused' })
    expect(requests).toHaveLength(1)
    expect(lines[0]).toMatchObject({ outcome: 'refused', stopReason: 'refusal' })
  })

  it('does not retry a reply cut off at max tokens', async () => {
    const { result, lines, requests } = await run([reply('{"name":"chi', 'max_tokens')])
    expect(result).toEqual({ ok: false, outcome: 'invalid' })
    expect(requests).toHaveLength(1)
    expect(lines[0]).toMatchObject({ outcome: 'invalid', stopReason: 'max_tokens' })
  })

  it('aborts a call that runs past the timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const pending = run(['hang'])
    await vi.advanceTimersByTimeAsync(aiConfig.features.vision.timeoutMs)
    const { result, lines, requests } = await pending
    expect(result).toEqual({ ok: false, outcome: 'timeout' })
    expect(requests[0]?.signal.aborted).toBe(true)
    expect(lines[0]).toMatchObject({ outcome: 'timeout' })
  })

  it('logs a provider error with its message', async () => {
    const { result, lines } = await run([{ throws: new Error('throttled') }])
    expect(result).toEqual({ ok: false, outcome: 'provider_error' })
    expect(lines[0]).toMatchObject({ outcome: 'provider_error', errorMessage: 'throttled' })
  })

  it('refuses without calling the model once the daily cap is reached', async () => {
    const { result, lines, requests } = await run([reply(valid)], 20)
    expect(result).toEqual({ ok: false, outcome: 'capped' })
    expect(requests).toHaveLength(0)
    expect(lines[0]).toMatchObject({ outcome: 'capped', inputTokens: 0 })
  })
})
