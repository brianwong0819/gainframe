import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createPlanStore, type PlanStore } from './plans'
import { createRepositories, type Repositories } from './repositories'
import { GainframeDb } from './schema'
import { countHistory, loadWorkoutHistory } from './workout-history'
import { createWorkoutSession, type WorkoutSession } from './workout-session'

const BENCH = '00000000-0000-7000-8000-000000000001'
const ZONE = 'Asia/Kuala_Lumpur'

let db: GainframeDb
let repos: Repositories
let session: WorkoutSession
let plans: PlanStore
let clock: Date

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  clock = new Date('2026-11-08T10:00:00.000Z')
  repos = createRepositories(db, () => clock)
  session = createWorkoutSession(db, repos, () => clock)
  plans = createPlanStore(db, repos)
})

afterEach(() => {
  db.close()
})

// Completes every set of the workout as 80 kg × `reps`, then finishes it.
async function finishWith(workoutId: string, reps: number) {
  const state = await session.loadActive()
  for (const set of state?.slots.flatMap((slot) => slot.sets) ?? []) {
    await repos.workoutSets.update(set.id, {
      weightKg: 80,
      reps,
      completedAt: clock.toISOString(),
    })
  }
  clock = new Date(clock.getTime() + 45 * 60_000)
  await session.finish(workoutId)
  clock = new Date(clock.getTime() + 24 * 60 * 60_000)
}

describe('loadWorkoutHistory', () => {
  it('lists finished workouts newest first, with their plan day', async () => {
    const empty = await session.start(ZONE)
    await session.addExercise(empty.id, BENCH)
    await finishWith(empty.id, 5)

    const plan = await plans.create('Split', 'Push')
    const day = await db.planDays.where('planId').equals(plan.id).first()
    if (day === undefined) throw new Error('No day')
    await plans.addItem(day.id, BENCH)
    const fromPlan = await session.startFromPlanDay(day.id, ZONE)
    await finishWith(fromPlan.id, 6)
    // A deleted day keeps its name in history.
    await repos.planDays.remove(day.id)

    await session.start(ZONE)

    const entries = await loadWorkoutHistory(db)
    expect(entries.map(({ workout }) => workout.id)).toEqual([fromPlan.id, empty.id])
    expect(entries.map(({ dayName }) => dayName)).toEqual(['Push', null])
    expect(entries[0]?.planName).toBe('Split')
    expect(entries[0]?.summary.recordCount).toBe(1)
    expect(entries[1]?.summary.durationS).toBe(45 * 60)
    expect(await countHistory(db)).toBe(2)
  })

  it('leaves out a finished workout with no completed set', async () => {
    const workout = await session.start(ZONE)
    await session.addExercise(workout.id, BENCH)
    await session.finish(workout.id)
    expect(await loadWorkoutHistory(db)).toEqual([])
    expect(await countHistory(db)).toBe(0)
  })
})
