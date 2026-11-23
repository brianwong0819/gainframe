import { describe, expect, it } from 'vitest'

import { localDateSchema } from '../schemas/row.ts'
import type { Workout, WorkoutSet } from '../schemas/workout.ts'
import {
  bestWeightKg,
  estimateOneRepMax,
  findPersonalRecords,
  nextSetValues,
  previousPerformance,
  setsFollowingWeight,
  setsTakingWeight,
  totalVolumeKg,
} from './workout.ts'

const BENCH = '01960000-0000-7000-8000-000000000001'
const SQUAT = '01960000-0000-7000-8000-000000000002'
const DIP = '01960000-0000-7000-8000-000000000003'
const MONDAY = '01960000-0000-7000-8000-0000000000a1'
const THURSDAY = '01960000-0000-7000-8000-0000000000a2'
const SATURDAY = '01960000-0000-7000-8000-0000000000a3'

const row = {
  userId: null,
  createdAt: '2026-11-02T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
  deletedAt: null,
}

const isDip = (exerciseId: string) => exerciseId === DIP
const barbellOnly = { isBodyweight: isDip, bodyWeightKg: null }

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
    expect(totalVolumeKg(sets, barbellOnly)).toBe(600 + 400 + 360)
  })

  it('leaves out warm-ups, unfinished sets, deleted sets and 0-rep sets', () => {
    const sets = [
      set({ weightKg: 40, reps: 10, kind: 'warmup' }),
      set({ weightKg: 60, reps: 10, completedAt: null }),
      set({ weightKg: 60, reps: 10, deletedAt: '2026-11-02T11:00:00.000Z' }),
      set({ weightKg: 60, reps: 0 }),
      set({ weightKg: 60, reps: 5 }),
    ]
    expect(totalVolumeKg(sets, barbellOnly)).toBe(300)
  })

  it('is 0 for no sets', () => {
    expect(totalVolumeKg([], barbellOnly)).toBe(0)
  })

  it('counts only the added load of a bodyweight set until body weight is known', () => {
    const sets = [
      set({ exerciseId: DIP, weightKg: 0, reps: 10 }),
      set({ exerciseId: DIP, weightKg: 10, reps: 5 }),
    ]
    expect(totalVolumeKg(sets, { isBodyweight: isDip, bodyWeightKg: null })).toBe(50)
  })

  it('adds the body weight to a bodyweight set once it is known', () => {
    const sets = [set({ exerciseId: DIP, weightKg: 10, reps: 5 }), set({ weightKg: 60, reps: 10 })]
    expect(totalVolumeKg(sets, { isBodyweight: isDip, bodyWeightKg: 70 })).toBe(80 * 5 + 600)
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
  const records = (current: WorkoutSet[], earlier: WorkoutSet[] = history) =>
    findPersonalRecords(current, earlier, isDip)

  it('marks a working set that beats the best earlier e1RM', () => {
    const record = set({ workoutId: THURSDAY, weightKg: 85, reps: 5 }) // 99.2
    const below = set({ workoutId: THURSDAY, weightKg: 80, reps: 4 }) // 90.7
    expect(records([record, below])).toEqual(new Map([[record.id, ['e1rm', 'reps']]]))
  })

  it('does not count an equal set as a record', () => {
    const equal = set({ workoutId: THURSDAY, weightKg: 80, reps: 5 })
    expect(records([equal]).size).toBe(0)
  })

  it('marks more reps at the same or a higher weight as a rep record', () => {
    // 60 × 6 has the lower e1RM (72), but nothing at 60 kg or more reached 6 reps.
    const lighter = set({ workoutId: THURSDAY, weightKg: 60, reps: 6 })
    expect(records([lighter])).toEqual(new Map([[lighter.id, ['reps']]]))
  })

  it('does not count fewer reps at a lower weight', () => {
    const lighter = set({ workoutId: THURSDAY, weightKg: 70, reps: 5 })
    expect(records([lighter]).size).toBe(0)
  })

  it('counts a set above the e1RM rep limit as a rep record only', () => {
    const many = set({ workoutId: THURSDAY, weightKg: 80, reps: 15 })
    expect(records([many])).toEqual(new Map([[many.id, ['reps']]]))
  })

  it('counts a bodyweight exercise by reps only', () => {
    const earlier = [set({ exerciseId: DIP, weightKg: 0, reps: 10 })]
    const more = set({ workoutId: THURSDAY, exerciseId: DIP, weightKg: 0, reps: 11 })
    const loaded = set({ workoutId: THURSDAY, exerciseId: DIP, weightKg: 10, reps: 5 })
    const fewer = set({ workoutId: THURSDAY, exerciseId: DIP, weightKg: 0, reps: 9 })
    expect(records([more, loaded, fewer], earlier)).toEqual(
      new Map([
        [more.id, ['reps']],
        [loaded.id, ['reps']],
      ]),
    )
  })

  it('never counts warm-up or drop sets as records', () => {
    const current = [
      set({ workoutId: THURSDAY, weightKg: 100, reps: 5, kind: 'warmup' }),
      set({ workoutId: THURSDAY, weightKg: 100, reps: 5, kind: 'drop' }),
    ]
    expect(records(current).size).toBe(0)
  })

  it('counts a failure set as a record', () => {
    const failure = set({ workoutId: THURSDAY, weightKg: 85, reps: 6, kind: 'failure' })
    expect(records([failure])).toEqual(new Map([[failure.id, ['e1rm', 'reps']]]))
  })

  it('ignores 0-rep sets', () => {
    expect(records([set({ workoutId: THURSDAY, weightKg: 200, reps: 0 })]).size).toBe(0)
  })

  it('needs an earlier e1RM to report an e1RM record', () => {
    const highReps = [set({ weightKg: 50, reps: 15 })]
    const heavy = set({ workoutId: THURSDAY, weightKg: 60, reps: 5 })
    expect(records([heavy], highReps)).toEqual(new Map([[heavy.id, ['reps']]]))
  })

  it('does not let a warm-up in the history raise the bar', () => {
    const heavyWarmup = set({ weightKg: 120, reps: 5, kind: 'warmup' })
    const record = set({ workoutId: THURSDAY, weightKg: 85, reps: 5 })
    expect(records([record], [...history, heavyWarmup])).toEqual(
      new Map([[record.id, ['e1rm', 'reps']]]),
    )
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
    expect(records([higher, lower, first])).toEqual(
      new Map([
        [first.id, ['e1rm', 'reps']],
        [higher.id, ['e1rm', 'reps']],
      ]),
    )
  })

  it('has no records for an exercise done for the first time', () => {
    const squat = set({ workoutId: THURSDAY, exerciseId: SQUAT, weightKg: 100, reps: 5 })
    expect(records([squat]).size).toBe(0)
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
    expect(records([record, deletedRecord], [...history, deletedBest])).toEqual(
      new Map([[record.id, ['e1rm', 'reps']]]),
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

describe('setsTakingWeight', () => {
  const done = set({ weightKg: 70, reps: 8, position: 1 })
  const open = (position: number, weightKg: number) =>
    set({ weightKg, reps: 8, position, completedAt: null })

  it('takes the later sets that are not done and have no weight yet', () => {
    const later = open(2, 0)
    const typed = open(3, 60)
    const finished = set({ weightKg: 0, reps: 8, position: 4 })
    expect(setsTakingWeight(done, [done, later, typed, finished])).toEqual([later])
  })

  it('leaves earlier sets alone', () => {
    const third = set({ weightKg: 70, reps: 8, position: 3 })
    expect(setsTakingWeight(third, [open(1, 0), open(2, 0), third])).toEqual([])
  })

  it('carries nothing from a set without weight', () => {
    const bodyweight = set({ weightKg: 0, reps: 10, position: 1 })
    expect(setsTakingWeight(bodyweight, [bodyweight, open(2, 0)])).toEqual([])
  })
})

describe('setsFollowingWeight', () => {
  const before = set({ weightKg: 36.25, reps: 8, position: 1 })
  const open = (position: number, weightKg: number) =>
    set({ weightKg, reps: 8, position, completedAt: null })

  it('takes the later sets that are not done and still at the old weight', () => {
    const same = open(2, 36.25)
    const typed = open(3, 40)
    const finished = set({ weightKg: 36.25, reps: 8, position: 4 })
    expect(setsFollowingWeight(before, [before, same, typed, finished])).toEqual([same])
  })

  it('leaves earlier sets alone', () => {
    const third = set({ weightKg: 36.25, reps: 8, position: 3 })
    expect(setsFollowingWeight(third, [open(1, 36.25), open(2, 36.25), third])).toEqual([])
  })

  it('changes nothing when the edited set is not done', () => {
    const first = open(1, 36.25)
    expect(setsFollowingWeight(first, [first, open(2, 36.25)])).toEqual([])
  })
})
