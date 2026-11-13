import { describe, expect, it } from 'vitest'

import { localDateSchema } from '../schemas/row.ts'
import type { Workout, WorkoutSet } from '../schemas/workout.ts'
import {
  bestWeightKg,
  estimateOneRepMax,
  findPersonalRecords,
  nextSetValues,
  previousPerformance,
  totalVolumeKg,
} from './workout.ts'

const BENCH = '01960000-0000-7000-8000-000000000001'
const SQUAT = '01960000-0000-7000-8000-000000000002'
const MONDAY = '01960000-0000-7000-8000-0000000000a1'
const THURSDAY = '01960000-0000-7000-8000-0000000000a2'
const SATURDAY = '01960000-0000-7000-8000-0000000000a3'

const row = {
  userId: null,
  createdAt: '2026-11-02T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
  deletedAt: null,
}

let nextId = 0

function set(fields: Partial<WorkoutSet> & Pick<WorkoutSet, 'weightKg' | 'reps'>): WorkoutSet {
  nextId += 1
  return {
    ...row,
    id: `01960000-0000-7000-8000-${String(nextId).padStart(12, '0')}`,
    workoutExerciseId: '01960000-0000-7000-8000-0000000000c1',
    workoutId: MONDAY,
    exerciseId: BENCH,
    position: nextId,
    kind: 'working',
    rpe: null,
    completedAt: `2026-11-02T10:${String(nextId % 60).padStart(2, '0')}:00.000Z`,
    ...fields,
  }
}

function workout(id: string, startedAt: string, fields: Partial<Workout> = {}): Workout {
  return {
    ...row,
    id,
    startedAt,
    endedAt: null,
    planDayId: null,
    localDate: localDateSchema.parse(startedAt.slice(0, 10)),
    note: null,
    restStartedAt: null,
    restEndsAt: null,
    ...fields,
  }
}

describe('estimateOneRepMax', () => {
  it('applies the Epley formula', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.667, 3)
    expect(estimateOneRepMax(60, 10)).toBeCloseTo(80, 6)
  })

  it('treats a single as its own 1RM', () => {
    expect(estimateOneRepMax(140, 1)).toBe(140)
  })

  it('has no estimate for 0 reps or more reps than the configured limit', () => {
    expect(estimateOneRepMax(100, 0)).toBeNull()
    expect(estimateOneRepMax(40, 12)).not.toBeNull()
    expect(estimateOneRepMax(40, 13)).toBeNull()
  })
})

describe('totalVolumeKg', () => {
  it('sums weight × reps of completed working, drop and failure sets', () => {
    const sets = [
      set({ weightKg: 60, reps: 10 }),
      set({ weightKg: 50, reps: 8, kind: 'drop' }),
      set({ weightKg: 60, reps: 6, kind: 'failure' }),
    ]
    expect(totalVolumeKg(sets)).toBe(600 + 400 + 360)
  })

  it('leaves out warm-ups, unfinished sets, deleted sets and 0-rep sets', () => {
    const sets = [
      set({ weightKg: 40, reps: 10, kind: 'warmup' }),
      set({ weightKg: 60, reps: 10, completedAt: null }),
      set({ weightKg: 60, reps: 10, deletedAt: '2026-11-02T11:00:00.000Z' }),
      set({ weightKg: 60, reps: 0 }),
      set({ weightKg: 60, reps: 5 }),
    ]
    expect(totalVolumeKg(sets)).toBe(300)
  })

  it('is 0 for no sets', () => {
    expect(totalVolumeKg([])).toBe(0)
  })
})

describe('previousPerformance', () => {
  const workouts = [
    workout(MONDAY, '2026-11-02T10:00:00.000Z'),
    workout(THURSDAY, '2026-11-05T10:00:00.000Z'),
    workout(SATURDAY, '2026-11-07T10:00:00.000Z'),
  ]

  it('returns the bench sets of the latest earlier workout, in position order', () => {
    const second = set({ workoutId: THURSDAY, weightKg: 62.5, reps: 6, position: 2 })
    const first = set({ workoutId: THURSDAY, weightKg: 62.5, reps: 8, position: 1 })
    const sets = [set({ weightKg: 60, reps: 8 }), second, first]
    const result = previousPerformance({
      exerciseId: BENCH,
      before: '2026-11-07T10:00:00.000Z',
      workouts,
      sets,
    })
    expect(result.map((s) => s.id)).toEqual([first.id, second.id])
  })

  it('skips a later workout that did not include the exercise', () => {
    const monday = set({ weightKg: 60, reps: 8 })
    const sets = [monday, set({ workoutId: THURSDAY, exerciseId: SQUAT, weightKg: 80, reps: 5 })]
    const result = previousPerformance({
      exerciseId: BENCH,
      before: '2026-11-07T10:00:00.000Z',
      workouts,
      sets,
    })
    expect(result.map((s) => s.id)).toEqual([monday.id])
  })

  it('skips deleted workouts, deleted sets and unfinished sets', () => {
    const monday = set({ weightKg: 60, reps: 8 })
    const sets = [
      monday,
      set({ workoutId: THURSDAY, weightKg: 62.5, reps: 8, deletedAt: '2026-11-05T11:00:00.000Z' }),
      set({ workoutId: THURSDAY, weightKg: 62.5, reps: 8, completedAt: null }),
      set({ workoutId: SATURDAY, weightKg: 65, reps: 8 }),
    ]
    const result = previousPerformance({
      exerciseId: BENCH,
      before: '2026-11-08T10:00:00.000Z',
      workouts: workouts.map((w) =>
        w.id === SATURDAY ? { ...w, deletedAt: '2026-11-07T12:00:00.000Z' } : w,
      ),
      sets,
    })
    expect(result.map((s) => s.id)).toEqual([monday.id])
  })

  it('returns nothing when the exercise has never been done', () => {
    const result = previousPerformance({
      exerciseId: SQUAT,
      before: '2026-11-08T10:00:00.000Z',
      workouts,
      sets: [set({ weightKg: 60, reps: 8 })],
    })
    expect(result).toEqual([])
  })
})

describe('nextSetValues', () => {
  const lastTime = [
    set({ kind: 'warmup', weightKg: 40, reps: 10 }),
    set({ weightKg: 60, reps: 8 }),
    set({ weightKg: 60, reps: 7 }),
  ]

  it('takes the set with the same index from last time', () => {
    expect(nextSetValues(lastTime, [])).toEqual({ kind: 'warmup', weightKg: 40, reps: 10 })
    expect(nextSetValues(lastTime, lastTime.slice(0, 2))).toEqual({
      kind: 'working',
      weightKg: 60,
      reps: 7,
    })
  })

  it("repeats the slot's own last set once past last time's count", () => {
    const today = [...lastTime, set({ weightKg: 62.5, reps: 6 })]
    expect(nextSetValues(lastTime, today)).toEqual({ kind: 'working', weightKg: 62.5, reps: 6 })
  })

  it("repeats the slot's last set when there is no last time", () => {
    expect(nextSetValues([], [set({ kind: 'drop', weightKg: 50, reps: 12 })])).toEqual({
      kind: 'drop',
      weightKg: 50,
      reps: 12,
    })
  })

  it('starts an exercise never done before from the configured first set', () => {
    expect(nextSetValues([], [])).toEqual({ kind: 'working', weightKg: 0, reps: 8 })
  })
})

describe('findPersonalRecords', () => {
  const history = [set({ weightKg: 80, reps: 5 })] // e1RM 93.3

  it('marks a working set that beats the best earlier e1RM', () => {
    const record = set({ workoutId: THURSDAY, weightKg: 85, reps: 5 }) // 99.2
    const below = set({ workoutId: THURSDAY, weightKg: 80, reps: 4 }) // 90.7
    expect(findPersonalRecords([record, below], history)).toEqual(new Set([record.id]))
  })

  it('does not count an equal e1RM as a record', () => {
    const equal = set({ workoutId: THURSDAY, weightKg: 80, reps: 5 })
    expect(findPersonalRecords([equal], history).size).toBe(0)
  })

  it('never counts warm-up or drop sets as records', () => {
    const current = [
      set({ workoutId: THURSDAY, weightKg: 100, reps: 5, kind: 'warmup' }),
      set({ workoutId: THURSDAY, weightKg: 100, reps: 5, kind: 'drop' }),
    ]
    expect(findPersonalRecords(current, history).size).toBe(0)
  })

  it('counts a failure set as a record', () => {
    const failure = set({ workoutId: THURSDAY, weightKg: 85, reps: 6, kind: 'failure' })
    expect(findPersonalRecords([failure], history)).toEqual(new Set([failure.id]))
  })

  it('ignores 0-rep sets and sets above the rep limit', () => {
    const current = [
      set({ workoutId: THURSDAY, weightKg: 200, reps: 0 }),
      set({ workoutId: THURSDAY, weightKg: 80, reps: 20 }),
    ]
    expect(findPersonalRecords(current, history).size).toBe(0)
  })

  it('does not let a warm-up in the history raise the bar', () => {
    const heavyWarmup = set({ weightKg: 120, reps: 5, kind: 'warmup' })
    const record = set({ workoutId: THURSDAY, weightKg: 85, reps: 5 })
    expect(findPersonalRecords([record], [...history, heavyWarmup])).toEqual(new Set([record.id]))
  })

  it('compares each set with the earlier sets of the same workout', () => {
    // e1RM: first 99.2, lower 96.3, higher 101.8.
    const first = set({
      workoutId: THURSDAY,
      weightKg: 85,
      reps: 5,
      completedAt: '2026-11-05T10:10:00.000Z',
    })
    const lower = set({
      workoutId: THURSDAY,
      weightKg: 82.5,
      reps: 5,
      completedAt: '2026-11-05T10:15:00.000Z',
    })
    const higher = set({
      workoutId: THURSDAY,
      weightKg: 92.5,
      reps: 3,
      completedAt: '2026-11-05T10:20:00.000Z',
    })
    // Passed out of order: completion time decides.
    expect(findPersonalRecords([higher, lower, first], history)).toEqual(
      new Set([first.id, higher.id]),
    )
  })

  it('has no records for an exercise done for the first time', () => {
    const squat = set({ workoutId: THURSDAY, exerciseId: SQUAT, weightKg: 100, reps: 5 })
    expect(findPersonalRecords([squat], history).size).toBe(0)
  })

  it('ignores deleted sets on both sides', () => {
    const deletedBest = set({ weightKg: 100, reps: 5, deletedAt: '2026-11-03T10:00:00.000Z' })
    const record = set({ workoutId: THURSDAY, weightKg: 85, reps: 5 })
    const deletedRecord = set({
      workoutId: THURSDAY,
      weightKg: 95,
      reps: 5,
      deletedAt: '2026-11-05T11:00:00.000Z',
    })
    expect(findPersonalRecords([record, deletedRecord], [...history, deletedBest])).toEqual(
      new Set([record.id]),
    )
  })
})

describe('bestWeightKg', () => {
  it('takes the heaviest completed working or failure set', () => {
    const sets = [
      set({ weightKg: 60, reps: 10 }),
      set({ weightKg: 70, reps: 3, kind: 'failure' }),
      set({ weightKg: 80, reps: 5, kind: 'warmup' }),
      set({ weightKg: 90, reps: 2, completedAt: null }),
      set({ weightKg: 95, reps: 1, deletedAt: '2026-11-03T10:00:00.000Z' }),
    ]
    expect(bestWeightKg(sets)).toBe(70)
  })

  it('has no best weight without a counted set', () => {
    expect(bestWeightKg([])).toBeNull()
    expect(bestWeightKg([set({ weightKg: 40, reps: 10, kind: 'warmup' })])).toBeNull()
  })
})
