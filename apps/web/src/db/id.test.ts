import { z } from 'zod'
import { describe, expect, it } from 'vitest'

import { newId } from './id'

describe('newId', () => {
  it('returns a UUIDv7', () => {
    expect(z.uuidv7().safeParse(newId(Date.UTC(2026, 10, 8, 10))).success).toBe(true)
  })

  it('encodes the creation time in the first 48 bits', () => {
    const at = Date.UTC(2026, 10, 8, 10, 30)
    const id = newId(at)
    expect(Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(at)
  })

  it('sorts IDs from later milliseconds after earlier ones', () => {
    const earlier = newId(Date.UTC(2026, 10, 8, 10))
    const later = newId(Date.UTC(2026, 10, 8, 10) + 1)
    expect(earlier < later).toBe(true)
  })

  it('does not repeat within the same millisecond', () => {
    const at = Date.UTC(2026, 10, 8, 10)
    const ids = new Set(Array.from({ length: 1000 }, () => newId(at)))
    expect(ids.size).toBe(1000)
  })
})
