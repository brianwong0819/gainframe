import { describe, expect, it } from 'vitest'

import { formatRepRange, restInfo, withRepsMax, withRepsMin } from './item-edit'

describe('rep range edits', () => {
  it('formats a range, or one number when both ends are equal', () => {
    expect(formatRepRange({ repsMin: 8, repsMax: 12 })).toBe('8–12')
    expect(formatRepRange({ repsMin: 5, repsMax: 5 })).toBe('5')
  })

  it('moves the other end along so the range never inverts', () => {
    const range = { repsMin: 8, repsMax: 12 }
    expect(withRepsMin(range, 10)).toEqual({ repsMin: 10, repsMax: 12 })
    expect(withRepsMin(range, 14)).toEqual({ repsMin: 14, repsMax: 14 })
    expect(withRepsMax(range, 10)).toEqual({ repsMin: 8, repsMax: 10 })
    expect(withRepsMax(range, 6)).toEqual({ repsMin: 6, repsMax: 6 })
  })
})

describe('restInfo', () => {
  it('reads a built-in exercise, and has no mechanic for a custom one', () => {
    expect(restInfo('00000000-0000-7000-8000-000000000001', [])).toMatchObject({
      mechanic: 'compound',
    })
    const custom = {
      id: '01960000-0000-7000-8000-000000000001',
      userId: null,
      createdAt: '2026-11-09T10:00:00.000Z',
      updatedAt: '2026-11-09T10:00:00.000Z',
      deletedAt: null,
      nameZh: '地雷管推举',
      nameEn: null,
      muscle: 'shoulders' as const,
      secondaryMuscles: [],
      equipment: 'barbell' as const,
      defaultRestS: 75,
    }
    expect(restInfo(custom.id, [custom])).toEqual({ defaultRestS: 75, mechanic: null })
  })
})
