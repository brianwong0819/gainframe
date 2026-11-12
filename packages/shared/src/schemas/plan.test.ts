import { describe, expect, it } from 'vitest'

import { planItemSchema } from './plan.ts'

const item = {
  id: '01960000-0000-7000-8000-000000000001',
  userId: null,
  createdAt: '2026-11-09T10:00:00.000Z',
  updatedAt: '2026-11-09T10:00:00.000Z',
  deletedAt: null,
  planId: '01960000-0000-7000-8000-0000000000f1',
  planDayId: '01960000-0000-7000-8000-0000000000d1',
  exerciseId: '00000000-0000-7000-8000-000000000001',
  position: 0,
  supersetGroup: null,
  targetSets: 3,
  repsMin: 8,
  repsMax: 12,
  restS: null,
  note: null,
}

describe('planItemSchema', () => {
  it('accepts a rep range and a single rep count', () => {
    expect(planItemSchema.safeParse(item).success).toBe(true)
    expect(planItemSchema.safeParse({ ...item, repsMin: 5, repsMax: 5 }).success).toBe(true)
  })

  it('rejects a rep range that ends below its start', () => {
    const result = planItemSchema.safeParse({ ...item, repsMin: 12, repsMax: 8 })
    expect(result.error?.issues[0]?.path).toEqual(['repsMax'])
  })

  it('keeps a note up to 500 characters', () => {
    expect(planItemSchema.safeParse({ ...item, note: 'Seat at notch 4' }).success).toBe(true)
    expect(planItemSchema.safeParse({ ...item, note: 'x'.repeat(501) }).success).toBe(false)
  })
})
