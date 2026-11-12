import { BUILT_IN_EXERCISES, type Exercise } from '@gainframe/shared'
import { describe, expect, it } from 'vitest'

import { findExercise, formatWeight } from './exercise-info'

describe('findExercise', () => {
  const custom: Exercise = {
    id: '01960000-0000-7000-8000-000000000001',
    userId: null,
    createdAt: '2026-11-08T10:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
    deletedAt: '2026-11-09T10:00:00.000Z',
    nameZh: '地雷管推举',
    nameEn: null,
    muscle: 'shoulders',
    secondaryMuscles: [],
    equipment: 'barbell',
    defaultRestS: 90,
  }

  it('finds built-in exercises and deleted custom ones', () => {
    const [bench] = BUILT_IN_EXERCISES
    expect(findExercise(bench?.id ?? '', [])).toMatchObject({ nameEn: bench?.nameEn })
    expect(findExercise(custom.id, [custom]).nameZh).toBe('地雷管推举')
  })

  it('falls back to an unnamed exercise', () => {
    expect(findExercise('01960000-0000-7000-8000-000000000009', [])).toEqual({
      nameZh: null,
      nameEn: null,
      equipment: 'other',
    })
  })
})

describe('formatWeight', () => {
  it('drops trailing zeros and float noise', () => {
    expect(formatWeight(60, 'kg')).toBe('60')
    expect(formatWeight(62.5, 'kg')).toBe('62.5')
    expect(formatWeight(0.1 + 0.2, 'kg')).toBe('0.3')
  })

  it('shows pounds to 0.1 lb', () => {
    expect(formatWeight(20.41, 'lb')).toBe('45')
    expect(formatWeight(60, 'lb')).toBe('132.3')
  })
})
