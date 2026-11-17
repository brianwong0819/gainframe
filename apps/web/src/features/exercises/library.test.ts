import { describe, expect, it } from 'vitest'

import type { Exercise } from '@gainframe/shared'
import { BUILT_IN_EXERCISES, muscleGroupSchema } from '@gainframe/shared'

import {
  draftToExercise,
  exerciseName,
  findLibraryEntry,
  formatRest,
  libraryEntries,
  type MuscleSelection,
  newDraft,
  pickMuscle,
} from './library'

function custom(fields: Partial<Exercise> & Pick<Exercise, 'id' | 'createdAt'>): Exercise {
  return {
    userId: null,
    updatedAt: fields.createdAt,
    deletedAt: null,
    nameZh: null,
    nameEn: 'Landmine press',
    muscle: 'shoulders',
    secondaryMuscles: [],
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

  it('groups the built-in exercises by muscle in the filter order', () => {
    const order = muscleGroupSchema.options
    const muscles = libraryEntries([], null, '').map((entry) => order.indexOf(entry.muscle))
    expect(muscles).toEqual([...muscles].sort((a, b) => a - b))
    expect(muscles).toHaveLength(BUILT_IN_EXERCISES.length)
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

describe('draftToExercise', () => {
  it('trims names and turns a blank name into null', () => {
    const values = draftToExercise({
      nameZh: '  ',
      nameEn: ' Landmine press ',
      muscle: 'shoulders',
      secondaryMuscles: ['triceps'],
      equipment: 'barbell',
      defaultRestS: 90,
    })
    expect(values.nameZh).toBeNull()
    expect(values.nameEn).toBe('Landmine press')
  })
})

describe('newDraft', () => {
  it('puts a Chinese search in the Chinese name and any other in the English one', () => {
    expect(newDraft(' 史密斯深蹲 ', null)).toMatchObject({ nameZh: '史密斯深蹲', nameEn: '' })
    expect(newDraft('Smith squat', 'quads')).toMatchObject({
      nameZh: '',
      nameEn: 'Smith squat',
      muscle: 'quads',
    })
  })
})

describe('pickMuscle', () => {
  const none: MuscleSelection = { muscle: null, secondaryMuscles: [] }
  const taps = (...muscles: Parameters<typeof pickMuscle>[1][]) => muscles.reduce(pickMuscle, none)

  it('makes the first tap primary and later taps secondary', () => {
    expect(taps('chest', 'triceps', 'shoulders')).toEqual({
      muscle: 'chest',
      secondaryMuscles: ['triceps', 'shoulders'],
    })
  })

  it('unpicks a secondary muscle', () => {
    expect(taps('chest', 'triceps', 'shoulders', 'triceps')).toEqual({
      muscle: 'chest',
      secondaryMuscles: ['shoulders'],
    })
  })

  it('promotes the first secondary muscle when the primary one is unpicked', () => {
    expect(taps('chest', 'triceps', 'shoulders', 'chest')).toEqual({
      muscle: 'triceps',
      secondaryMuscles: ['shoulders'],
    })
    expect(taps('chest', 'chest')).toEqual(none)
  })

  it('keeps full body on its own', () => {
    expect(taps('chest', 'triceps', 'full_body')).toEqual({
      muscle: 'full_body',
      secondaryMuscles: [],
    })
    expect(taps('full_body', 'quads')).toEqual({ muscle: 'quads', secondaryMuscles: [] })
  })
})

describe('findLibraryEntry', () => {
  it('finds a built-in exercise and a custom one, and nothing else', () => {
    expect(findLibraryEntry('00000000-0000-7000-8000-000000000001', [])).toMatchObject({
      custom: false,
      mechanic: 'compound',
    })
    const own = custom({
      id: '01960000-0000-7000-8000-000000000001',
      createdAt: '2026-11-13T00:00:00.000Z',
    })
    expect(findLibraryEntry(own.id, [own])).toEqual({ ...own, custom: true })
    expect(findLibraryEntry('01960000-0000-7000-8000-000000000002', [own])).toBeUndefined()
  })
})
