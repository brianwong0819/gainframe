import { localDateSchema } from '@gainframe/shared'
import { describe, expect, it } from 'vitest'

import { formatDay, formatMonth } from './dates'

// Vitest runs in America/Los_Angeles, where midnight UTC is still the day before.
const day = localDateSchema.parse('2026-11-14')

describe('history dates', () => {
  it('formats the stored day, not the day before in a zone west of UTC', () => {
    expect(formatDay(day, 'en')).toBe('Sat, Nov 14')
    expect(formatDay(day, 'zh')).toBe('11月14日周六')
  })

  it('names the month', () => {
    expect(formatMonth(day, 'en')).toBe('November 2026')
    expect(formatMonth(day, 'zh')).toBe('2026年11月')
  })
})
