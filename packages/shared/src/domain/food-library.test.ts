import { describe, expect, it } from 'vitest'

import type { Food } from '../schemas/food.ts'
import type { FoodTableEntry } from '../schemas/food-table.ts'
import {
  currentFoods,
  foodLibrary,
  per100G,
  portionOf,
  withLibraryPortions,
} from './food-library.ts'
import type { PastFood } from './nutrition.ts'

const whey: FoodTableEntry = {
  id: 'usda-173180',
  nameEn: 'Whey protein powder',
  nameZh: '乳清蛋白粉',
  aliases: ['Protein powder'],
  proteinPer100G: 78.1,
  kcalPer100G: 352,
  servingG: 31,
  servingLabel: { en: '1 scoop', zh: '1 勺' },
  source: 'usda',
}

const rice: FoodTableEntry = {
  id: 'myfcd-R1',
  nameEn: 'Rice, cooked',
  nameZh: '白饭',
  aliases: ['Nasi'],
  proteinPer100G: 2.3,
  kcalPer100G: 130,
  servingG: 160,
  servingLabel: null,
  source: 'myfcd',
}

let seq = 0
function food(values: Partial<Food>): Food {
  seq += 1
  return {
    id: `01960000-0000-7000-8000-${String(seq).padStart(12, '0')}`,
    userId: null,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    deletedAt: null,
    tableId: null,
    name: 'My whey',
    proteinPer100G: 68.6,
    kcalPer100G: 371,
    servings: [{ label: '1 scoop', grams: 35 }],
    ...values,
  }
}

describe('currentFoods', () => {
  it('skips deleted foods and keeps the latest edit of each table entry', () => {
    const older = food({ tableId: whey.id, updatedAt: '2026-11-23T10:00:00.000Z' })
    const newer = food({ tableId: whey.id, updatedAt: '2026-11-23T11:00:00.000Z' })
    const own = food({})
    const gone = food({ deletedAt: '2026-11-23T12:00:00.000Z' })
    expect(currentFoods([newer, older, own, gone])).toEqual([newer, own])
  })
})

describe('foodLibrary', () => {
  it('shows the table as shipped, in the app language, with its named serving', () => {
    const [first, second] = foodLibrary([whey, rice], [], 'zh')
    expect(first).toMatchObject({
      key: whey.id,
      origin: 'table',
      name: '乳清蛋白粉',
      servings: [{ label: '1 勺', grams: 31 }],
    })
    expect(second).toMatchObject({ name: '白饭', servings: [{ label: null, grams: 160 }] })
  })

  it("replaces an edited entry with the user's figures and keeps its names searchable", () => {
    const edit = food({ tableId: whey.id, name: 'Gold whey' })
    const [entry] = foodLibrary([whey], [edit], 'en')
    expect(entry).toMatchObject({
      key: whey.id,
      origin: 'edited',
      foodId: edit.id,
      name: 'Gold whey',
      nameEn: 'Whey protein powder',
      aliases: ['Protein powder', 'Gold whey'],
      proteinPer100G: 68.6,
      servings: [{ label: '1 scoop', grams: 35 }],
    })
  })

  it('restores the entry once the edit is deleted', () => {
    const edit = food({ tableId: whey.id, deletedAt: '2026-11-23T12:00:00.000Z' })
    expect(foodLibrary([whey], [edit], 'en')[0]?.origin).toBe('table')
  })

  it('lists own foods first, newest first', () => {
    const first = food({ name: 'Oat bar', createdAt: '2026-11-20T10:00:00.000Z' })
    const second = food({ name: 'Soy milk', createdAt: '2026-11-22T10:00:00.000Z' })
    expect(foodLibrary([rice], [first, second], 'en').map((entry) => entry.name)).toEqual([
      'Soy milk',
      'Oat bar',
      'Rice, cooked',
    ])
  })
})

describe('portionOf and per100G', () => {
  it('turns a label serving into figures per 100 g and back', () => {
    const figures = per100G({ grams: 35, proteinG: 24, kcal: 130 })
    expect(figures.proteinPer100G).toBeCloseTo(68.571, 3)
    const scoop = portionOf(figures, 35)
    expect(scoop.proteinG).toBeCloseTo(24, 9)
    expect(scoop.kcal).toBeCloseTo(130, 9)
  })
})

describe('withLibraryPortions', () => {
  const past: PastFood = {
    name: 'my WHEY',
    grams: 30,
    proteinG: 17,
    kcal: 108,
    count: 9,
    lastAt: '2026-11-22T08:00:00.000Z',
  }

  it("gives a past food the library food's figures for the amount last eaten, ignoring case", () => {
    const [item] = withLibraryPortions([past], [food({})])
    expect(item).toMatchObject({ name: 'my WHEY', grams: 30, count: 9, lastAt: past.lastAt })
    expect(item?.proteinG).toBeCloseTo(20.58, 2)
  })

  it('leaves a past food without a library food as it was', () => {
    expect(withLibraryPortions([past], [food({ name: 'Oat bar' })])).toEqual([past])
  })
})
