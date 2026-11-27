import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createRepositories, type Repositories } from './repositories'
import { GainframeDb } from './schema'
import { createWorkoutSession, type WorkoutSession } from './workout-session'
import { loadWorkoutSummary } from './workout-summary'

const BENCH = '00000000-0000-7000-8000-000000000001'
const ZONE = 'Asia/Kuala_Lumpur'

let db: GainframeDb
let repos: Repositories
let session: WorkoutSession
let clock: Date

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  clock = new Date('2026-11-08T10:00:00.000Z')
  repos = createRepositories(db, () => clock)
  session = createWorkoutSession(db, repos, () => clock)
})

afterEach(() => {
  db.close()
})

function advance(minutes: number) {
  clock = new Date(clock.getTime() + minutes * 60_000)
}

// A finished workout of bench press with one set per entry of `sets`.
async function benchWorkout(sets: readonly [number, number][]) {
  const workout = await session.start(ZONE)
  const slot = await session.addExercise(workout.id, BENCH)
  const created = await session.loadActive()
  let setId = created?.slots[0]?.sets[0]?.id
  for (const [index, [weightKg, reps]] of sets.entries()) {
    if (index > 0) setId = (await session.addSet(slot.id)).id
    if (setId === undefined) throw new Error('No set')
    advance(3)
    await repos.workoutSets.update(setId, { weightKg, reps, completedAt: clock.toISOString() })
  }
  advance(10)
  await session.finish(workout.id)
  advance(24 * 60)
  return workout
}

// A finished workout of the plan day with its first set done at `weightKg` × 5.
async function dayWorkout(planDayId: string, weightKg: number) {
  const workout = await session.startFromPlanDay(planDayId, ZONE)
  const setId = (await session.loadActive())?.slots[0]?.sets[0]?.id
  if (setId === undefined) throw new Error('No set')
  advance(3)
  await repos.workoutSets.update(setId, { weightKg, reps: 5, completedAt: clock.toISOString() })
  await session.finish(workout.id)
  advance(24 * 60)
  return workout
}

describe('loadWorkoutSummary', () => {
  it('summarises a finished workout against the earlier ones', async () => {
    await benchWorkout([[80, 5]])
    const second = await benchWorkout([
      [85, 5],
      [80, 5],
    ])
    const state = await loadWorkoutSummary(db, second.id)
    expect(state?.summary.durationS).toBe(16 * 60)
    expect(state?.summary.volumeKg).toBe(85 * 5 + 80 * 5)
    expect(state?.summary.recordCount).toBe(1)
    expect(state?.summary.exercises[0]?.records[0]?.set.weightKg).toBe(85)
  })

  it('does not compare with later or deleted workouts', async () => {
    const first = await benchWorkout([[80, 5]])
    const deleted = await benchWorkout([[100, 5]])
    await repos.workouts.remove(deleted.id)
    await benchWorkout([[120, 5]])
    const state = await loadWorkoutSummary(db, first.id)
    expect(state?.summary.recordCount).toBe(0)
    const later = await benchWorkout([[90, 5]])
    expect((await loadWorkoutSummary(db, later.id))?.summary.recordCount).toBe(0)
  })

  it('is null for a missing or deleted workout', async () => {
    const workout = await benchWorkout([[80, 5]])
    await repos.workouts.remove(workout.id)
    expect(await loadWorkoutSummary(db, workout.id)).toBeNull()
  })

  it('carries the last time the same plan day was done', async () => {
    const plan = await repos.plans.create({ name: 'Push Pull Legs', activatedAt: null })
    const day = await repos.planDays.create({ planId: plan.id, name: 'Push', position: 0 })
    await repos.planItems.create({
      planId: plan.id,
      planDayId: day.id,
      exerciseId: BENCH,
      position: 0,
      supersetGroup: null,
      targetSets: 1,
      repsMin: 5,
      repsMax: 8,
      restS: null,
      note: null,
    })
    const first = await dayWorkout(day.id, 80)
    // A workout started empty is not the same day, even with the same exercise.
    const empty = await benchWorkout([[90, 5]])
    const second = await dayWorkout(day.id, 85)

    expect((await loadWorkoutSummary(db, first.id))?.previous).toBeNull()
    expect((await loadWorkoutSummary(db, empty.id))?.previous).toBeNull()
    expect((await loadWorkoutSummary(db, second.id))?.previous?.volumeKg).toBe(80 * 5)

    await repos.workouts.remove(first.id)
    expect((await loadWorkoutSummary(db, second.id))?.previous).toBeNull()
  })
})
