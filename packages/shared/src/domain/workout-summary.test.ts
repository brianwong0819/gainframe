import { describe, expect, it } from 'vitest'

import { localDateSchema } from '../schemas/row.ts'
import type { Workout, WorkoutExercise, WorkoutSet } from '../schemas/workout.ts'
import { summarizeHistory, summarizeWorkout } from './workout-summary.ts'

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
    const late = set({ weightKg: 80, reps: 5, completedAt: '2026-11-05T11:00:00.000Z' })
    expect(summarizeWorkout({ workout, slots, sets: [late], history, load }).durationS).toBe(
      62 * 60 + 30,
    )
  })

  it('totals volume without warm-ups and counts completed sets with them', () => {
    expect(summary.volumeKg).toBe(85 * 5 + 85 * 4)
    expect(summary.setsDone).toBe(4)
  })

  it('lists exercises in slot order with their own figures', () => {
    expect(summary.exercises.map(({ slot }) => slot.id)).toEqual([BENCH_SLOT, DIP_SLOT])
    const [bench, dip] = summary.exercises
    expect(bench?.setsDone).toBe(3)
    expect(bench?.sets.map(({ id }) => id)).toEqual([warmup.id, record.id, second.id])
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

  it('ends the duration at the last set when the workout was left open', () => {
    const left = { ...workout, endedAt: '2026-11-06T08:00:00.000Z' }
    const last = set({ weightKg: 80, reps: 5, completedAt: '2026-11-05T10:50:00.000Z' })
    expect(summarizeWorkout({ workout: left, slots, sets: [last], history, load }).durationS).toBe(
      50 * 60,
    )
    // Finished within half an hour of the last set: the finish counts.
    const onTime = { ...workout, endedAt: '2026-11-05T11:15:00.000Z' }
    expect(
      summarizeWorkout({ workout: onTime, slots, sets: [last], history, load }).durationS,
    ).toBe(75 * 60)
  })

  it('has no top set when only warm-ups were done', () => {
    const only = summarizeWorkout({ workout, slots, sets: [warmup], history, load })
    expect(only.exercises[0]?.topSet).toBeNull()
  })
})

describe('summarizeHistory', () => {
  // Three bench press workouts a day apart, each with one 80 kg set of
  // `reps[i]` reps; the second is the only record.
  const day = (n: number) => `2026-11-0${String(n)}T10:00:00.000Z`
  const workouts = [1, 2, 3].map((n) => ({
    ...workout,
    id: `w${String(n)}`,
    startedAt: day(n),
    endedAt: day(n).replace('T10', 'T11'),
  }))
  const reps = [5, 6, 4]
  const sets = workouts.map((other, index) =>
    set({
      workoutId: other.id,
      workoutExerciseId: `s${other.id}`,
      weightKg: 80,
      reps: reps[index] ?? 0,
      completedAt: other.startedAt.replace('T10:00', 'T10:30'),
    }),
  )
  const slotsOf = workouts.map((other) => ({
    ...slot(`s${other.id}`, BENCH, 0),
    workoutId: other.id,
  }))

  it('lists finished workouts newest first, each against the ones before it', () => {
    const entries = summarizeHistory({ workouts, slots: slotsOf, sets, load })
    expect(entries.map(({ workout }) => workout.id)).toEqual(['w3', 'w2', 'w1'])
    expect(entries.map(({ summary }) => summary.recordCount)).toEqual([0, 1, 0])
    expect(entries[0]?.summary.volumeKg).toBe(80 * 4)
  })

  it('leaves out deleted, unfinished and empty workouts', () => {
    const [first, second, third] = workouts
    if (first === undefined || second === undefined || third === undefined) throw new Error()
    const entries = summarizeHistory({
      workouts: [{ ...first, deletedAt: day(4) }, second, { ...third, endedAt: null }],
      slots: slotsOf,
      sets: sets.map((other) =>
        other.workoutId === 'w2' ? { ...other, deletedAt: day(4) } : other,
      ),
      load,
    })
    // w2's only set is deleted, so it has nothing to show.
    expect(entries).toEqual([])
  })
})
