import { describe, expect, it } from 'vitest'

import { mealItemSchema, mealSchema } from './food.ts'

const row = {
  id: '01960000-0000-7000-8000-000000000001',
  userId: null,
  createdAt: '2026-11-22T12:00:00.000Z',
  updatedAt: '2026-11-22T12:00:00.000Z',
  deletedAt: null,
}

const validMeal = {
  ...row,
  eatenAt: '2026-11-22T11:45:00.000Z',
  localDate: '2026-11-22',
  mealType: 'lunch',
  name: null,
  photoKey: null,
}

const validItem = {
  ...row,
  id: '01960000-0000-7000-8000-000000000002',
  mealId: row.id,
  position: 0,
  name: 'Chicken rice',
  grams: 350,
  proteinG: 32,
  kcal: 610,
  source: 'ai',
  aiRaw: { name: 'Chicken rice', grams: 300, proteinG: 28, kcal: 540, alternatives: ['Duck rice'] },
}

describe('mealSchema', () => {
  it('accepts a valid meal', () => {
    expect(mealSchema.safeParse(validMeal).success).toBe(true)
  })

  it('rejects an unknown meal type and a day that is not a date', () => {
    expect(mealSchema.safeParse({ ...validMeal, mealType: 'brunch' }).success).toBe(false)
    expect(mealSchema.safeParse({ ...validMeal, localDate: '2026-11-22T00:00' }).success).toBe(
      false,
    )
  })

  it('rejects a blank name', () => {
    expect(mealSchema.safeParse({ ...validMeal, name: '  ' }).success).toBe(false)
  })
})

describe('mealItemSchema', () => {
  it('accepts a valid item, with or without the model output', () => {
    expect(mealItemSchema.safeParse(validItem).success).toBe(true)
    expect(mealItemSchema.safeParse({ ...validItem, source: 'manual', aiRaw: null }).success).toBe(
      true,
    )
  })

  it('rejects a portion of zero grams and negative figures', () => {
    expect(mealItemSchema.safeParse({ ...validItem, grams: 0 }).success).toBe(false)
    expect(mealItemSchema.safeParse({ ...validItem, proteinG: -1 }).success).toBe(false)
    expect(mealItemSchema.safeParse({ ...validItem, kcal: -1 }).success).toBe(false)
  })

  it('rejects a stored estimate that is not an object or is too long', () => {
    expect(mealItemSchema.safeParse({ ...validItem, aiRaw: 'text' }).success).toBe(false)
    const long = { note: 'x'.repeat(4000) }
    expect(mealItemSchema.safeParse({ ...validItem, aiRaw: long }).success).toBe(false)
  })
})
