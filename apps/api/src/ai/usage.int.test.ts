import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import { createDatabase, createPool } from '../db/client.ts'
import { parseDatabaseUrl } from '../env.ts'
import { createLogger } from '../log.ts'
import { usageStore } from './usage.ts'

const pool = createPool(
  parseDatabaseUrl(process.env),
  createLogger({ release: 'test', write: () => undefined }),
)
const usage = usageStore(createDatabase(pool))

afterAll(async () => {
  await pool.end()
})

const tokens = (input: number) => ({
  inputTokens: input,
  outputTokens: 10,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
})

describe('usageStore', () => {
  it('counts calls up to the cap, per user, day and feature', async () => {
    const a = { userId: `user-${randomUUID()}`, feature: 'vision', day: '2026-11-23' }
    const b = { ...a, userId: `user-${randomUUID()}` }
    expect(await usage.reserve(a, 2)).toBe(true)
    expect(await usage.reserve(a, 2)).toBe(true)
    expect(await usage.reserve(a, 2)).toBe(false)
    // Another user, and the same user on the next day, have their own count.
    expect(await usage.reserve(b, 2)).toBe(true)
    expect(await usage.reserve({ ...a, day: '2026-11-24' }, 2)).toBe(true)
  })

  it('lets only the cap through when calls arrive at once', async () => {
    const key = { userId: `user-${randomUUID()}`, feature: 'vision', day: '2026-11-23' }
    const results = await Promise.all(Array.from({ length: 8 }, () => usage.reserve(key, 3)))
    expect(results.filter(Boolean)).toHaveLength(3)
  })

  it('adds tokens to the row of the call', async () => {
    const key = { userId: `user-${randomUUID()}`, feature: 'vision', day: '2026-11-23' }
    await usage.reserve(key, 5)
    await usage.addTokens(key, tokens(100))
    await usage.addTokens(key, tokens(50))
    const { rows } = await pool.query<{ input_tokens: number; output_tokens: number }>(
      'select input_tokens, output_tokens from ai_usage where user_id = $1',
      [key.userId],
    )
    expect(rows).toEqual([{ input_tokens: 150, output_tokens: 20 }])
  })
})
