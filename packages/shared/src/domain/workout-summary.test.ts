import { describe, expect, it } from 'vitest'

import { localDateSchema } from '../schemas/row.ts'
import type { Workout, WorkoutExercise, WorkoutSet } from '../schemas/workout.ts'
import { summarizeWorkout } from './workout-summary.ts'

const BENCH = '01960000-0000-7000-8000-000000000001'
const DIP = '01960000-0000-7000-8000-000000000003'
const WORKOUT = '01960000-0000-7000-8000-0000000000a2'
const BENCH_SLOT = '01960000-0000-7000-8000-0000000000c1'
const DIP_SLOT = '01960000-0000-7000-8000-0000000000c2'

const row = {
  userId: null,
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:00.000Z',
  deletedAt: null,
}

const workout: Workout = {
  ...row,
  id: WORKOUT,
  startedAt: '2026-11-05T10:00:00.000Z',
  endedAt: '2026-11-05T11:02:30.000Z',
  planDayId: null,
  localDate: localDateSchema.parse('2026-11-05'),
  note: null,
  restStartedAt: null,
  restEndsAt: null,
}

function slot(id: string, exerciseId: string, position: number): WorkoutExercise {
  return {
    ...row,
    id,
    workoutId: WORKOUT,
    exerciseId,
    position,
    supersetGroup: null,
    note: null,
    repsMin: null,
    repsMax: null,
    restS: null,
    planNote: null,
  }
}

let nextId = 0

function set(fields: Partial<WorkoutSet> & Pick<WorkoutSet, 'weightKg' | 'reps'>): WorkoutSet {
  nextId += 1
  return {
    ...row,
    id: `01960000-0000-7000-8000-${String(nextId).padStart(12, '0')}`,
    workoutExerciseId: BENCH_SLOT,
    workoutId: WORKOUT,
    exerciseId: BENCH,
    position: nextId,
    kind: 'working',
    rpe: null,
    completedAt: `2026-11-05T10:${String(nextId % 60).padStart(2, '0')}:00.000Z`,
    ...fields,
  }
}

const load = { isBodyweight: (id: string) => id === DIP, bodyWeightKg: null }
const slots = [slot(DIP_SLOT, DIP, 1), slot(BENCH_SLOT, BENCH, 0)]
const history = [
  set({ workoutId: 'earlier', workoutExerciseId: 'earlier', weightKg: 80, reps: 5 }),
  set({
    workoutId: 'earlier',
    workoutExerciseId: 'earlier',
    exerciseId: DIP,
    weightKg: 0,
    reps: 12,
  }),
]

describe('summarizeWorkout', () => {
  const warmup = set({ weightKg: 40, reps: 10, kind: 'warmup' })
  const record = set({ weightKg: 85, reps: 5 })
  const second = set({ weightKg: 85, reps: 4 })
  const planned = set({ weightKg: 85, reps: 5, completedAt: null })
  const dips = set({ workoutExerciseId: DIP_SLOT, exerciseId: DIP, weightKg: 0, reps: 10 })
  const summary = summarizeWorkout({
    workout,
    slots,
    sets: [warmup, record, second, planned, dips],
    history,
    load,
  })

  it('reports the duration in seconds', () => {
    expect(summary.durationS).toBe(62 * 60 + 30)
  })

  it('totals volume without warm-ups and counts completed sets with them', () => {
    expect(summary.volumeKg).toBe(85 * 5 + 85 * 4)
    expect(summary.setsDone).toBe(4)
  })

  it('lists exercises in slot order with their own figures', () => {
    expect(summary.exercises.map(({ slot }) => slot.id)).toEqual([BENCH_SLOT, DIP_SLOT])
    const [bench, dip] = summary.exercises
    expect(bench?.setsDone).toBe(3)
    expect(bench?.topSet?.id).toBe(record.id)
    expect(bench?.records).toEqual([{ set: record, kinds: ['e1rm', 'reps'] }])
    expect(dip?.volumeKg).toBe(0)
    expect(dip?.records).toEqual([])
  })

  it('counts the records', () => {
    expect(summary.recordCount).toBe(1)
  })

  it('has no duration before the workout ends, and leaves out deleted slots', () => {
    const open = summarizeWorkout({
      workout: { ...workout, endedAt: null },
      slots: [slot(BENCH_SLOT, BENCH, 0), { ...slot(DIP_SLOT, DIP, 1), deletedAt: row.createdAt }],
      sets: [record],
      history,
      load,
    })
    expect(open.durationS).toBeNull()
    expect(open.exercises).toHaveLength(1)
  })

  it('has no top set when only warm-ups were done', () => {
    const only = summarizeWorkout({ workout, slots, sets: [warmup], history, load })
    expect(only.exercises[0]?.topSet).toBeNull()
  })
})
