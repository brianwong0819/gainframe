import { describe, expect, it } from 'vitest'

import { nutritionTotals } from './nutrition.ts'

describe('nutritionTotals', () => {
  it('is zero without items', () => {
    expect(nutritionTotals([])).toEqual({ proteinG: 0, kcal: 0 })
  })

  it('sums the live items and skips deleted ones', () => {
    const items = [
      { proteinG: 32.5, kcal: 610, deletedAt: null },
      { proteinG: 6, kcal: 78, deletedAt: null },
      { proteinG: 25, kcal: 120, deletedAt: '2026-11-22T12:00:00.000Z' },
    ]
    expect(nutritionTotals(items)).toEqual({ proteinG: 38.5, kcal: 688 })
  })

  it('does not round the sum', () => {
    const items = [
      { proteinG: 0.4, kcal: 1.4, deletedAt: null },
      { proteinG: 0.4, kcal: 1.4, deletedAt: null },
    ]
    expect(nutritionTotals(items)).toEqual({ proteinG: 0.8, kcal: 2.8 })
  })
})
