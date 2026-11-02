import { describe, expect, it } from 'vitest'

import { parseEnv } from './env.ts'

describe('parseEnv', () => {
  it('accepts a postgres connection string', () => {
    const url = 'postgres://gainframe:gainframe@localhost:5432/gainframe'

    expect(parseEnv({ DATABASE_URL: url })).toEqual({ DATABASE_URL: url })
  })

  it('accepts the postgresql scheme used by Neon', () => {
    const url = 'postgresql://app:secret@example.neon.tech/gainframe?sslmode=require'

    expect(parseEnv({ DATABASE_URL: url }).DATABASE_URL).toBe(url)
  })

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/)
  })

  it('rejects a non-postgres URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'https://example.com' })).toThrow(/DATABASE_URL/)
  })
})
