import { describe, expect, it } from 'vitest'

import type { PlanDay } from '../schemas/plan.ts'
import { localDateSchema } from '../schemas/row.ts'
import type { Workout, WorkoutExercise, WorkoutSet } from '../schemas/workout.ts'
import { nextPlanDay, planItemsFromWorkout } from './plan.ts'

const PLAN = '01960000-0000-7000-8000-0000000000f1'
const DELETED = '2026-11-03T09:00:00.000Z'

const row = {
  userId: null,
  createdAt: '2026-11-02T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
  deletedAt: null,
}

function day(n: number, name: string, position: number, fields: Partial<PlanDay> = {}): PlanDay {
  return {
    ...row,
    id: `01960000-0000-7000-8000-0000000000d${String(n)}`,
    planId: PLAN,
    name,
    position,
    ...fields,
  }
}

const push = day(1, 'Push', 0)
const pull = day(2, 'Pull', 1)
const legs = day(3, 'Legs', 2)

let nextId = 0

function workout(
  planDay: PlanDay | null,
  startedAt: string,
  fields: Partial<Workout> = {},
): Workout {
  nextId += 1
  return {
    ...row,
    id: `01960000-0000-7000-8000-${String(nextId).padStart(12, '0')}`,
    startedAt,
    endedAt: new Date(Date.parse(startedAt) + 3_600_000).toISOString(),
    planDayId: planDay?.id ?? null,
    localDate: localDateSchema.parse('2026-11-02'),
    note: null,
    restStartedAt: null,
    restEndsAt: null,
    ...fields,
  }
}

describe('nextPlanDay', () => {
  it('starts a plan with no finished workouts at its first day', () => {
    expect(nextPlanDay([legs, push, pull], [])).toBe(push)
  })

  it('has no next day for a plan without days', () => {
    expect(nextPlanDay([], [workout(null, '2026-11-02T10:00:00.000Z')])).toBeUndefined()
  })

  it('follows the day of the latest finished workout, not the order they are given in', () => {
    const workouts = [
      workout(pull, '2026-11-04T10:00:00.000Z'),
      workout(push, '2026-11-02T10:00:00.000Z'),
    ]
    expect(nextPlanDay([push, pull, legs], workouts)).toBe(legs)
  })

  it('wraps round to the first day after the last one', () => {
    expect(nextPlanDay([push, pull, legs], [workout(legs, '2026-11-06T10:00:00.000Z')])).toBe(push)
  })

  it('ignores workouts in progress, deleted, started empty or from another plan', () => {
    const otherPlanDay = day(9, 'Arms', 0, { planId: '01960000-0000-7000-8000-0000000000f2' })
    const workouts = [
      workout(push, '2026-11-02T10:00:00.000Z'),
      workout(pull, '2026-11-04T10:00:00.000Z', { endedAt: null }),
      workout(legs, '2026-11-05T10:00:00.000Z', { deletedAt: DELETED }),
      workout(null, '2026-11-06T10:00:00.000Z'),
      workout(otherPlanDay, '2026-11-07T10:00:00.000Z'),
    ]
    expect(nextPlanDay([push, pull, legs], workouts)).toBe(pull)
  })

  it('skips deleted days and does not count a workout that followed one', () => {
    const deletedPull = { ...pull, deletedAt: DELETED }
    const workouts = [
      workout(push, '2026-11-02T10:00:00.000Z'),
      workout(deletedPull, '2026-11-04T10:00:00.000Z'),
    ]
    expect(nextPlanDay([push, deletedPull, legs], workouts)).toBe(legs)
  })
})

describe('planItemsFromWorkout', () => {
  const WORKOUT = '01960000-0000-7000-8000-0000000000a1'
  const slot = (n: number, position: number, fields: Partial<WorkoutExercise> = {}) => ({
    ...row,
    id: `01960000-0000-7000-8000-0000000000c${String(n)}`,
    workoutId: WORKOUT,
    exerciseId: `00000000-0000-7000-8000-00000000000${String(n)}`,
    position,
    supersetGroup: null,
    note: null,
    repsMin: null,
    repsMax: null,
    restS: null,
    planNote: null,
    ...fields,
  })
  let setId = 0
  const set = (slotId: string, reps: number, fields: Partial<WorkoutSet> = {}): WorkoutSet => {
    setId += 1
    return {
      ...row,
      id: `01960000-0000-7000-8000-${String(setId).padStart(12, '0')}`,
      workoutExerciseId: slotId,
      workoutId: WORKOUT,
      exerciseId: '00000000-0000-7000-8000-000000000001',
      position: setId,
      kind: 'working',
      weightKg: 60,
      reps,
      rpe: null,
      completedAt: '2026-11-02T10:30:00.000Z',
      ...fields,
    }
  }

  it('turns completed working sets into target sets and a rep range, in slot order', () => {
    const bench = slot(1, 1, { restS: 150, planNote: 'Grip one finger out' })
    const squat = slot(2, 0)
    const sets = [
      set(bench.id, 10),
      set(bench.id, 8),
      set(bench.id, 7, { kind: 'failure' }),
      set(bench.id, 15, { kind: 'warmup' }),
      set(bench.id, 12, { kind: 'drop' }),
      set(bench.id, 3, { completedAt: null }),
      set(squat.id, 5),
    ]
    expect(planItemsFromWorkout([bench, squat], sets)).toEqual([
      {
        exerciseId: squat.exerciseId,
        position: 0,
        supersetGroup: null,
        targetSets: 1,
        repsMin: 5,
        repsMax: 5,
        restS: null,
        note: null,
      },
      {
        exerciseId: bench.exerciseId,
        position: 1,
        supersetGroup: null,
        targetSets: 3,
        repsMin: 7,
        repsMax: 10,
        restS: 150,
        note: 'Grip one finger out',
      },
    ])
  })

  it('leaves out deleted slots and exercises without a counted set', () => {
    const bench = slot(1, 0, { deletedAt: DELETED })
    const squat = slot(2, 1)
    const curl = slot(3, 2)
    const sets = [set(bench.id, 8), set(squat.id, 0, { kind: 'warmup' }), set(curl.id, 0)]
    expect(planItemsFromWorkout([bench, squat, curl], sets)).toEqual([
      {
        exerciseId: curl.exerciseId,
        position: 0,
        supersetGroup: null,
        targetSets: 1,
        repsMin: 1,
        repsMax: 1,
        restS: null,
        note: null,
      },
    ])
  })
})
