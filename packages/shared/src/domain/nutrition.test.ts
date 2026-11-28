import { describe, expect, it } from 'vitest'

import { localDateSchema } from '../schemas/row.ts'
import {
  addDays,
  fillProteinGap,
  habitualFoods,
  mealTypeAt,
  nutritionTotals,
  pastFoods,
  reestimatedFigures,
  scalePortion,
} from './nutrition.ts'

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

describe('mealTypeAt', () => {
  it('names the meal from the hour', () => {
    expect([4, 5, 10, 11, 14, 15, 16, 17, 21, 22, 23].map(mealTypeAt)).toEqual([
      'snack',
      'breakfast',
      'breakfast',
      'lunch',
      'lunch',
      'snack',
      'snack',
      'dinner',
      'dinner',
      'snack',
      'snack',
    ])
  })
})

describe('pastFoods', () => {
  const item = (
    name: string,
    createdAt: string,
    proteinG = 10,
    deletedAt: string | null = null,
  ) => ({
    name,
    grams: 100,
    proteinG,
    kcal: 100,
    createdAt,
    deletedAt,
  })
  const items = [
    item('Egg', '2026-11-20T01:00:00.000Z', 6),
    item('Chicken rice', '2026-11-21T04:00:00.000Z'),
    item('egg ', '2026-11-22T01:00:00.000Z', 7),
    item('Milo', '2026-11-22T02:00:00.000Z'),
    item('Tofu', '2026-11-22T03:00:00.000Z', 10, '2026-11-22T03:10:00.000Z'),
  ]

  it('merges names that differ only in case and spacing, keeping the latest figures', () => {
    const [egg] = pastFoods(items, 'frequent')
    expect(egg).toEqual({
      name: 'egg ',
      grams: 100,
      proteinG: 7,
      kcal: 100,
      count: 2,
      lastAt: '2026-11-22T01:00:00.000Z',
    })
  })

  it('orders by count then recency, or by recency, and skips deleted items', () => {
    expect(pastFoods(items, 'frequent').map((food) => food.name)).toEqual([
      'egg ',
      'Milo',
      'Chicken rice',
    ])
    expect(pastFoods(items, 'recent').map((food) => food.name)).toEqual([
      'Milo',
      'egg ',
      'Chicken rice',
    ])
  })

  it('is empty without items', () => {
    expect(pastFoods([], 'frequent')).toEqual([])
  })
})

describe('habitualFoods', () => {
  const today = localDateSchema.parse('2026-11-28')
  const item = (name: string, localDate: string, deletedAt: string | null = null) => ({
    name,
    grams: 100,
    proteinG: 10,
    kcal: 100,
    createdAt: `${localDate}T04:00:00.000Z`,
    deletedAt,
    localDate: localDateSchema.parse(localDate),
  })

  it('keeps foods eaten on at least three different days, not three meals on one day', () => {
    const items = [
      item('Egg', '2026-11-20'),
      item('Egg', '2026-11-24'),
      item('egg', '2026-11-28'),
      item('Milo', '2026-11-28'),
      item('Milo', '2026-11-28'),
      item('Milo', '2026-11-28'),
      item('Tofu', '2026-11-27'),
    ]
    expect(habitualFoods(items, today).map((food) => food.name)).toEqual(['egg'])
  })

  it('looks back 30 days including today, and skips deleted items', () => {
    const items = [
      item('Oats', '2026-10-29'),
      item('Oats', '2026-11-10'),
      item('Oats', '2026-11-11'),
      item('Rice', '2026-10-30'),
      item('Rice', '2026-11-10'),
      item('Rice', '2026-11-11'),
      item('Fish', '2026-11-10'),
      item('Fish', '2026-11-11'),
      item('Fish', '2026-11-12', '2026-11-12T05:00:00.000Z'),
    ]
    expect(habitualFoods(items, today).map((food) => food.name)).toEqual(['Rice'])
  })

  it('orders by days eaten, then by how recently', () => {
    const items = [
      ...['2026-11-01', '2026-11-02', '2026-11-03'].map((d) => item('Rice', d)),
      ...['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'].map((d) => item('Egg', d)),
      ...['2026-11-25', '2026-11-26', '2026-11-27'].map((d) => item('Milo', d)),
    ]
    expect(habitualFoods(items, today).map((food) => food.name)).toEqual(['Egg', 'Milo', 'Rice'])
  })

  it('is empty without items', () => {
    expect(habitualFoods([], today)).toEqual([])
  })
})

describe('addDays', () => {
  it('moves across months and years', () => {
    expect(addDays(localDateSchema.parse('2026-11-30'), 1)).toBe('2026-12-01')
    expect(addDays(localDateSchema.parse('2027-01-01'), -1)).toBe('2026-12-31')
  })
})

describe('scalePortion', () => {
  it('scales protein and energy with the grams', () => {
    expect(scalePortion({ grams: 200, proteinG: 30, kcal: 500 }, 150)).toEqual({
      grams: 150,
      proteinG: 22.5,
      kcal: 375,
    })
  })
})

describe('reestimatedFigures', () => {
  it('sums the estimate and scales it to the portion', () => {
    const estimate = [
      { grams: 300, proteinG: 10, kcal: 400, nutrients: 'table' as const },
      { grams: 100, proteinG: 20, kcal: 200, nutrients: 'table' as const },
    ]
    expect(reestimatedFigures(200, estimate)).toEqual({
      grams: 200,
      proteinG: 15,
      kcal: 300,
      nutrients: 'table',
    })
  })

  it('is tagged model when any item has model figures, and null without items', () => {
    const estimate = [
      { grams: 100, proteinG: 5, kcal: 100, nutrients: 'table' as const },
      { grams: 100, proteinG: 5, kcal: 100, nutrients: 'model' as const },
    ]
    expect(reestimatedFigures(100, estimate)?.nutrients).toBe('model')
    expect(reestimatedFigures(100, [])).toBeNull()
  })
})

describe('fillProteinGap', () => {
  const food = (name: string, proteinG: number) => ({
    name,
    grams: 100,
    proteinG,
    kcal: proteinG * 5,
    count: 1,
    lastAt: '2026-11-22T00:00:00.000Z',
  })
  const egg = food('Egg', 6)
  const milk = food('Milk', 8)
  const chicken = food('Chicken breast', 31)
  const yogurt = food('Greek yogurt', 15)

  it('suggests nothing without frequent foods or once the target is met', () => {
    expect(fillProteinGap(40, [])).toEqual([])
    expect(fillProteinGap(0, [egg, chicken])).toEqual([])
    expect(fillProteinGap(-5, [egg, chicken])).toEqual([])
  })

  it('takes the one food that covers the gap with the least overshoot', () => {
    expect(fillProteinGap(12, [chicken, egg, yogurt, milk])).toEqual([yogurt])
  })

  it('takes the smallest food when the gap is smaller than any food', () => {
    expect(fillProteinGap(3, [chicken, milk, egg])).toEqual([egg])
  })

  it('takes the pair that covers the gap with the least overshoot', () => {
    expect(fillProteinGap(38, [egg, chicken, yogurt, milk])).toEqual([chicken, milk])
  })

  it('takes the largest pair when no pair covers the gap', () => {
    expect(fillProteinGap(80, [egg, chicken, yogurt, milk])).toEqual([chicken, yogurt])
  })

  it('takes the largest food when only one fits the limit', () => {
    expect(fillProteinGap(80, [egg, chicken], 1)).toEqual([chicken])
    expect(fillProteinGap(80, [egg])).toEqual([egg])
  })
})
