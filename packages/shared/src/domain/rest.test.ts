import { describe, expect, it } from 'vitest'

import { domainConfig } from '../config.ts'
import { adjustRestEnd, restSeconds, restState } from './rest.ts'

const rest = { restStartedAt: '2026-11-13T10:00:00.000Z', restEndsAt: '2026-11-13T10:02:00.000Z' }
const at = (iso: string) => Date.parse(iso)

describe('restSeconds', () => {
  it("prefers the slot's rest, then the exercise's default, then the fallback", () => {
    expect(restSeconds(150, 90)).toBe(150)
    expect(restSeconds(null, 90)).toBe(90)
    expect(restSeconds(null, null)).toBe(domainConfig.rest.fallbackS)
  })

  it('keeps 0 as no rest rather than falling back', () => {
    expect(restSeconds(0, 90)).toBe(0)
  })
})

describe('restState', () => {
  it('counts down from the stored end', () => {
    expect(restState(rest, at('2026-11-13T10:00:30.000Z'))).toEqual({
      phase: 'running',
      remainingMs: 90_000,
      totalMs: 120_000,
    })
  })

  it('reports how long ago an elapsed rest ended', () => {
    expect(restState(rest, at('2026-11-13T10:02:42.000Z'))).toEqual({
      phase: 'over',
      overdueMs: 42_000,
    })
  })

  it('is over at the exact end', () => {
    expect(restState(rest, at(rest.restEndsAt))).toEqual({ phase: 'over', overdueMs: 0 })
  })
})

describe('adjustRestEnd', () => {
  const now = at('2026-11-13T10:01:00.000Z')

  it('moves the end by whole steps', () => {
    expect(adjustRestEnd(rest.restEndsAt, 15, now)).toBe('2026-11-13T10:02:15.000Z')
    expect(adjustRestEnd(rest.restEndsAt, -15, now)).toBe('2026-11-13T10:01:45.000Z')
  })

  it('never moves the end before now', () => {
    expect(adjustRestEnd(rest.restEndsAt, -90, now)).toBe('2026-11-13T10:01:00.000Z')
  })
})
