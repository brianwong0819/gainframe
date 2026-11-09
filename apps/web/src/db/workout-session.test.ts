import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createRepositories, type Repositories } from './repositories'
import { GainframeDb } from './schema'
import { createWorkoutSession, type WorkoutSession } from './workout-session'

const BENCH = '01960000-0000-7000-8000-000000000001'
const SQUAT = '01960000-0000-7000-8000-000000000002'
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

function advance(ms: number) {
  clock = new Date(clock.getTime() + ms)
}

async function complete(setId: string, weightKg: number, reps: number) {
  advance(60_000)
  return repos.workoutSets.update(setId, {
    weightKg,
    reps,
    completedAt: clock.toISOString(),
  })
}

describe('start', () => {
  it("starts an empty workout on the user's local date", async () => {
    clock = new Date('2026-11-08T17:30:00.000Z')
    const workout = await session.start(ZONE)
    expect(workout).toMatchObject({ endedAt: null, planDayId: null, localDate: '2026-11-09' })
    expect(await session.findActive()).toEqual(workout)
  })

  it('resumes the workout in progress instead of starting a second one', async () => {
    const first = await session.start(ZONE)
    advance(1000)
    expect(await session.start(ZONE)).toEqual(first)
    expect(await db.workouts.count()).toBe(1)
  })

  it('starts a new workout once the last one has finished', async () => {
    const first = await session.start(ZONE)
    advance(1000)
    await session.finish(first.id)
    expect(await session.findActive()).toBeUndefined()
    const second = await session.start(ZONE)
    expect(second.id).not.toBe(first.id)
  })

  it('ignores a deleted unfinished workout', async () => {
    const first = await session.start(ZONE)
    await repos.workouts.remove(first.id)
    expect(await session.findActive()).toBeUndefined()
  })
})

describe('loadActive', () => {
  it('is null when no workout is open', async () => {
    expect(await session.loadActive()).toBeNull()
  })

  it("lists live slots and sets in order, with last time's sets", async () => {
    const monday = await session.start(ZONE)
    const old = await session.addExercise(monday.id, BENCH)
    const [oldSet] = await db.workoutSets.where('workoutExerciseId').equals(old.id).toArray()
    await complete(oldSet?.id ?? '', 60, 8)
    await session.finish(monday.id)

    advance(86_400_000)
    const workout = await session.start(ZONE)
    const bench = await session.addExercise(workout.id, BENCH)
    const removed = await session.addExercise(workout.id, SQUAT)
    await repos.workoutExercises.remove(removed.id)
    const second = await session.addSet(bench.id)

    const state = await session.loadActive()
    expect(state?.workout.id).toBe(workout.id)
    expect(state?.slots.map(({ slot }) => slot.id)).toEqual([bench.id])
    expect(state?.slots[0]?.sets.map((set) => set.position)).toEqual([0, second.position])
    expect(state?.slots[0]?.previous.map((set) => set.id)).toEqual([oldSet?.id])
  })
})

describe('addExercise and addSet', () => {
  it('appends slots in order, each with one planned set', async () => {
    const workout = await session.start(ZONE)
    const bench = await session.addExercise(workout.id, BENCH)
    const squat = await session.addExercise(workout.id, SQUAT)
    expect([bench.position, squat.position]).toEqual([0, 1])

    const sets = await db.workoutSets.where('workoutExerciseId').equals(bench.id).toArray()
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({
      workoutId: workout.id,
      exerciseId: BENCH,
      position: 0,
      kind: 'working',
      weightKg: 0,
      reps: 8,
      completedAt: null,
    })
  })

  it("prefills each set from last time's set with the same index", async () => {
    const monday = await session.start(ZONE)
    const slot = await session.addExercise(monday.id, BENCH)
    const [first] = await db.workoutSets.where('workoutExerciseId').equals(slot.id).toArray()
    await complete(first?.id ?? '', 60, 8)
    const second = await session.addSet(slot.id)
    await complete(second.id, 62.5, 6)
    await session.finish(monday.id)

    advance(86_400_000)
    const thursday = await session.start(ZONE)
    const today = await session.addExercise(thursday.id, BENCH)
    const sets = [
      ...(await db.workoutSets.where('workoutExerciseId').equals(today.id).toArray()),
      await session.addSet(today.id),
      await session.addSet(today.id),
    ]
    expect(sets.map((set) => [set.position, set.weightKg, set.reps])).toEqual([
      [0, 60, 8],
      [1, 62.5, 6],
      [2, 62.5, 6],
    ])
  })

  it('does not reuse the position of a deleted set', async () => {
    const workout = await session.start(ZONE)
    const slot = await session.addExercise(workout.id, BENCH)
    const second = await session.addSet(slot.id)
    await repos.workoutSets.remove(second.id)
    expect((await session.addSet(slot.id)).position).toBe(2)
  })

  it('records every write in the outbox', async () => {
    const workout = await session.start(ZONE)
    const slot = await session.addExercise(workout.id, BENCH)
    const rows = (await db.outbox.toArray()).map(({ table, rowId }) => ({ table, rowId }))
    expect(rows.slice(0, 2)).toEqual([
      { table: 'workouts', rowId: workout.id },
      { table: 'workoutExercises', rowId: slot.id },
    ])
    expect(rows[2]?.table).toBe('workoutSets')
  })

  it('rejects a slot that was deleted', async () => {
    const workout = await session.start(ZONE)
    const slot = await session.addExercise(workout.id, BENCH)
    await repos.workoutExercises.remove(slot.id)
    await expect(session.addSet(slot.id)).rejects.toThrow('No exercise slot')
  })
})

describe('stepSet', () => {
  it('applies quick taps to the stored value and stops at 0', async () => {
    const workout = await session.start(ZONE)
    const slot = await session.addExercise(workout.id, BENCH)
    const [set] = await db.workoutSets.where('workoutExerciseId').equals(slot.id).toArray()
    const id = set?.id ?? ''
    await Promise.all([1, 2, 3].map(() => session.stepSet(id, 'weightKg', 2.5)))
    expect((await repos.workoutSets.get(id))?.weightKg).toBe(7.5)
    await session.stepSet(id, 'reps', -20)
    expect((await repos.workoutSets.get(id))?.reps).toBe(0)
  })
})

describe('startFromPlanDay', () => {
  async function pushDay() {
    const plan = await repos.plans.create({ name: 'Push Pull Legs' })
    const day = await repos.planDays.create({ planId: plan.id, name: 'Push', position: 0 })
    const item = (exerciseId: string, position: number, targetSets: number, restS: number | null) =>
      repos.planItems.create({
        planId: plan.id,
        planDayId: day.id,
        exerciseId,
        position,
        supersetGroup: null,
        targetSets,
        repsMin: 8,
        repsMax: 12,
        restS,
      })
    await item(SQUAT, 1, 2, null)
    await item(BENCH, 0, 3, 150)
    return day
  }

  it("lays out the day's exercises in order with their target sets, range and rest", async () => {
    const day = await pushDay()
    const workout = await session.startFromPlanDay(day.id, ZONE)
    expect(workout.planDayId).toBe(day.id)

    const state = await session.loadActive()
    expect(state?.slots.map(({ slot }) => [slot.exerciseId, slot.restS])).toEqual([
      [BENCH, 150],
      [SQUAT, null],
    ])
    expect(state?.slots[0]?.slot).toMatchObject({ repsMin: 8, repsMax: 12 })
    expect(state?.slots.map(({ sets }) => sets.length)).toEqual([3, 2])
    // Never done before: the default weight, and the low end of the rep range.
    expect(state?.slots[0]?.sets.map((set) => [set.weightKg, set.reps])).toEqual([
      [0, 8],
      [0, 8],
      [0, 8],
    ])
  })

  it("prefills last time's weights and shows the best weight of earlier workouts", async () => {
    const day = await pushDay()
    const first = await session.startFromPlanDay(day.id, ZONE)
    const firstState = await session.loadActive()
    const [heavy, light] = firstState?.slots[0]?.sets ?? []
    if (heavy === undefined || light === undefined) throw new Error('No sets')
    await complete(heavy.id, 70, 9)
    await complete(light.id, 65, 11)
    await session.finish(first.id)

    advance(86_400_000)
    await session.startFromPlanDay(day.id, ZONE)
    const state = await session.loadActive()
    expect(state?.slots[0]?.sets.map((set) => [set.weightKg, set.reps])).toEqual([
      [70, 8],
      [65, 8],
      [65, 8],
    ])
    expect(state?.slots[0]?.bestKg).toBe(70)
    expect(state?.slots[1]?.bestKg).toBeNull()
  })

  it('resumes the workout in progress instead', async () => {
    const day = await pushDay()
    const active = await session.start(ZONE)
    expect(await session.startFromPlanDay(day.id, ZONE)).toEqual(active)
    expect(await db.workoutExercises.count()).toBe(0)
  })
})
