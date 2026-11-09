import { describe, expect, it } from 'vitest'

import type { Exercise } from '@gainframe/shared'

import { exerciseName, formatRest, libraryEntries } from './library'

function custom(fields: Partial<Exercise> & Pick<Exercise, 'id' | 'createdAt'>): Exercise {
  return {
    userId: null,
    updatedAt: fields.createdAt,
    deletedAt: null,
    nameZh: null,
    nameEn: 'Landmine press',
    muscle: 'shoulders',
    equipment: 'barbell',
    defaultRestS: 90,
    ...fields,
  }
}

const older = custom({
  id: '019a6000-0000-7000-8000-000000000001',
  createdAt: '2026-11-01T10:00:00.000Z',
})
const newer = custom({
  id: '019a6000-0000-7000-8000-000000000002',
  createdAt: '2026-11-02T10:00:00.000Z',
  nameEn: 'Landmine row',
  muscle: 'back',
})

describe('libraryEntries', () => {
  it('lists custom exercises newest first, before the built-in ones', () => {
    const entries = libraryEntries([older, newer], null, '')
    expect(entries.slice(0, 3).map((entry) => entry.nameEn)).toEqual([
      'Landmine row',
      'Landmine press',
      'Barbell bench press',
    ])
    expect(entries[0]?.custom).toBe(true)
    expect(entries[2]?.custom).toBe(false)
  })

  it('narrows to one muscle group and the query', () => {
    expect(libraryEntries([older, newer], 'back', 'landmine').map((e) => e.nameEn)).toEqual([
      'Landmine row',
    ])
    expect(libraryEntries([], 'chest', '').every((entry) => entry.muscle === 'chest')).toBe(true)
  })
})

describe('exerciseName', () => {
  it('uses the app language and falls back to the other name', () => {
    const bench = { nameZh: '卧推', nameEn: 'Bench press' }
    expect(exerciseName(bench, 'zh')).toBe('卧推')
    expect(exerciseName(bench, 'en')).toBe('Bench press')
    expect(exerciseName({ nameZh: null, nameEn: 'Landmine press' }, 'zh')).toBe('Landmine press')
  })
})

describe('formatRest', () => {
  it('formats seconds as m:ss', () => {
    expect(formatRest(0)).toBe('0:00')
    expect(formatRest(90)).toBe('1:30')
    expect(formatRest(600)).toBe('10:00')
  })
})
