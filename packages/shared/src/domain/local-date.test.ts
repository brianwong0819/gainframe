import { describe, expect, it } from 'vitest'

import { toLocalDate } from './local-date.ts'

describe('toLocalDate', () => {
  it('keeps a 23:30 set on the same day and moves a 00:30 set to the next (UTC+8)', () => {
    expect(toLocalDate('2026-11-08T15:30:00Z', 'Asia/Kuala_Lumpur')).toBe('2026-11-08')
    expect(toLocalDate('2026-11-08T16:30:00Z', 'Asia/Kuala_Lumpur')).toBe('2026-11-09')
  })

  it('uses the time zone given, not the UTC date', () => {
    // 01:00 UTC on the 9th is still the evening of the 8th in Los Angeles.
    expect(toLocalDate('2026-11-09T01:00:00Z', 'America/Los_Angeles')).toBe('2026-11-08')
    expect(toLocalDate('2026-11-09T01:00:00Z', 'UTC')).toBe('2026-11-09')
  })

  it('handles the spring-forward day (UTC-8 before, UTC-7 after)', () => {
    expect(toLocalDate('2026-03-08T07:30:00Z', 'America/Los_Angeles')).toBe('2026-03-07')
    expect(toLocalDate('2026-03-08T08:30:00Z', 'America/Los_Angeles')).toBe('2026-03-08')
    expect(toLocalDate('2026-03-09T06:30:00Z', 'America/Los_Angeles')).toBe('2026-03-08')
    expect(toLocalDate('2026-03-09T07:30:00Z', 'America/Los_Angeles')).toBe('2026-03-09')
  })

  it('handles the repeated hour on the fall-back day', () => {
    // 01:30 PDT and 01:30 PST are an hour apart and both on 1 November.
    expect(toLocalDate('2026-11-01T08:30:00Z', 'America/Los_Angeles')).toBe('2026-11-01')
    expect(toLocalDate('2026-11-01T09:30:00Z', 'America/Los_Angeles')).toBe('2026-11-01')
    expect(toLocalDate('2026-11-02T07:30:00Z', 'America/Los_Angeles')).toBe('2026-11-01')
  })

  it('rejects an invalid instant and an unknown time zone', () => {
    expect(() => toLocalDate('not a date', 'UTC')).toThrow(RangeError)
    expect(() => toLocalDate('2026-11-08T00:00:00Z', 'Mars/Olympus')).toThrow(RangeError)
  })
})
