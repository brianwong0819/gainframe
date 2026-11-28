import { describe, expect, it } from 'vitest'

import type { MuscleGroup } from '../schemas/exercise.ts'
import { localDateSchema } from '../schemas/row.ts'
import type { SetKind } from '../schemas/workout.ts'
import {
  muscleHeat,
  muscleVolume,
  muscleZone,
  startingMuscle,
  trainedDirectly,
  type TrainedMuscle,
} from './muscle-volume.ts'

const date = (text: string) => localDateSchema.parse(text)

const BENCH = 'bench'
const CURL = 'curl'
const BURPEE = 'burpee'
const muscles = new Map<string, { muscle: MuscleGroup; secondaryMuscles: MuscleGroup[] }>([
  [BENCH, { muscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'] }],
  [CURL, { muscle: 'biceps', secondaryMuscles: ['forearms'] }],
  [BURPEE, { muscle: 'full_body', secondaryMuscles: ['chest', 'quads'] }],
])

const workouts = [
  { id: 'w-old', localDate: date('2026-11-21'), deletedAt: null },
  { id: 'w-mon', localDate: date('2026-11-23'), deletedAt: null },
  { id: 'w-sat', localDate: date('2026-11-28'), deletedAt: null },
  { id: 'w-deleted', localDate: date('2026-11-27'), deletedAt: '2026-11-27T12:00:00.000Z' },
]

function sets(
  workoutId: string,
  exerciseId: string,
  count: number,
  options: { kind?: SetKind; completed?: boolean; deleted?: boolean } = {},
) {
  return Array.from({ length: count }, () => ({
    workoutId,
    exerciseId,
    kind: options.kind ?? 'working',
    completedAt: options.completed === false ? null : '2026-11-23T10:00:00.000Z',
    deletedAt: options.deleted ? '2026-11-23T11:00:00.000Z' : null,
  }))
}

const week = { from: date('2026-11-22'), to: date('2026-11-28') }

describe('muscleVolume', () => {
  it('counts a primary muscle as one set and a secondary one as half', () => {
    const volume = muscleVolume({
      workouts,
      sets: [...sets('w-mon', BENCH, 4), ...sets('w-sat', BENCH, 3), ...sets('w-sat', CURL, 3)],
      muscles,
      ...week,
    })
    expect(volume.chest).toEqual({
      sets: 7,
      directSets: 7,
      contributions: [{ exerciseId: BENCH, sets: 7, share: 1 }],
    })
    expect(volume.triceps.sets).toBe(3.5)
    expect(volume.triceps.directSets).toBe(0)
    expect(volume.biceps.sets).toBe(3)
    expect(volume.forearms.sets).toBe(1.5)
    expect(volume.back.sets).toBe(0)
  })

  it('leaves out warm-ups, planned sets, deleted sets and workouts outside the range', () => {
    const volume = muscleVolume({
      workouts,
      sets: [
        ...sets('w-mon', BENCH, 2, { kind: 'warmup' }),
        ...sets('w-mon', BENCH, 2, { completed: false }),
        ...sets('w-mon', BENCH, 2, { deleted: true }),
        ...sets('w-old', BENCH, 5),
        ...sets('w-deleted', BENCH, 5),
        ...sets('w-mon', BENCH, 1, { kind: 'drop' }),
      ],
      muscles,
      ...week,
    })
    expect(volume.chest.sets).toBe(1)
  })

  it('counts a full-body exercise only through its secondary muscles', () => {
    const volume = muscleVolume({
      workouts,
      sets: [...sets('w-mon', BENCH, 2), ...sets('w-mon', BURPEE, 6)],
      muscles,
      ...week,
    })
    expect(volume.chest.sets).toBe(5)
    expect(volume.chest.directSets).toBe(2)
    expect(volume.chest.contributions).toEqual([
      { exerciseId: BURPEE, sets: 6, share: 0.5 },
      { exerciseId: BENCH, sets: 2, share: 1 },
    ])
    expect(volume.quads.sets).toBe(3)
  })

  it('counts nothing for an exercise missing from the library', () => {
    const volume = muscleVolume({ workouts, sets: sets('w-mon', 'gone', 3), muscles, ...week })
    expect(Object.values(volume).every((group) => group.sets === 0)).toBe(true)
  })
})

describe('trainedDirectly', () => {
  it('lists the groups that were a primary muscle in the range', () => {
    const volume = muscleVolume({
      workouts,
      sets: [...sets('w-mon', BENCH, 3), ...sets('w-mon', BURPEE, 2)],
      muscles,
      ...week,
    })
    expect(trainedDirectly(volume)).toEqual(new Set(['chest']))
  })
})

describe('muscleZone', () => {
  it('places sets in the bands, limits included', () => {
    expect(muscleZone(0, true)).toBe('none')
    expect(muscleZone(4.5, true)).toBe('low')
    expect(muscleZone(5, true)).toBe('effective')
    expect(muscleZone(9.5, true)).toBe('effective')
    expect(muscleZone(10, true)).toBe('target')
    expect(muscleZone(20, true)).toBe('target')
    expect(muscleZone(20.5, true)).toBe('high')
  })

  it('does not call a group low when it was not trained directly', () => {
    expect(muscleZone(1.5, false)).toBe('indirect')
    expect(muscleZone(0, false)).toBe('none')
    expect(muscleZone(6, false)).toBe('effective')
  })
})

describe('muscleHeat', () => {
  it('maps sets to the four fills', () => {
    expect([0, 0.5, 4.5, 5, 9.5, 10, 25].map(muscleHeat)).toEqual([0, 1, 1, 2, 2, 3, 3])
  })
})

describe('startingMuscle', () => {
  const volume = muscleVolume({
    workouts,
    sets: [...sets('w-mon', BENCH, 12), ...sets('w-sat', CURL, 4)],
    muscles,
    ...week,
  })

  it('opens on the directly trained group furthest below the target zone', () => {
    const direct = new Set<TrainedMuscle>(['chest', 'biceps', 'back'])
    // back has 0 sets and was trained directly in the last four weeks.
    expect(startingMuscle(volume, direct)).toBe('back')
    expect(startingMuscle(volume, new Set(['chest', 'biceps']))).toBe('biceps')
  })

  it('falls back to the group with the most sets, then to the first group', () => {
    expect(startingMuscle(volume, new Set(['chest']))).toBe('chest')
    expect(startingMuscle(volume, new Set())).toBe('chest')
    const nothing = muscleVolume({ workouts, sets: [], muscles, ...week })
    expect(startingMuscle(nothing, new Set())).toBe('chest')
  })
})
