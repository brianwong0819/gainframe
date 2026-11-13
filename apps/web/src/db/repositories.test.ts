import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type Exercise, toLocalDate } from '@gainframe/shared'

import { createRepositories, type NewRow, nextUpdatedAt } from './repositories'
import { GainframeDb } from './schema'

const start = new Date('2026-11-08T10:00:00.000Z')

let db: GainframeDb
let clock: Date
let repos: ReturnType<typeof createRepositories>

beforeEach(() => {
  // A fresh in-memory IndexedDB per test.
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  clock = start
  repos = createRepositories(db, () => clock)
})

afterEach(() => {
  db.close()
})

function advance(ms: number) {
  clock = new Date(clock.getTime() + ms)
}

const exercise: NewRow<Exercise> = {
  nameZh: '上斜哑铃卧推',
  nameEn: null,
  muscle: 'chest',
  secondaryMuscles: [],
  equipment: 'dumbbell',
  defaultRestS: 120,
}

function newWorkout() {
  return repos.workouts.create({
    startedAt: clock.toISOString(),
    endedAt: null,
    planDayId: null,
    localDate: toLocalDate(clock.toISOString(), 'Asia/Kuala_Lumpur'),
    note: null,
    restStartedAt: null,
    restEndsAt: null,
  })
}

const BENCH = '01960000-0000-7000-8000-0000000000b1'

function newSlot(workoutId: string, position: number) {
  return repos.workoutExercises.create({
    workoutId,
    exerciseId: BENCH,
    position,
    supersetGroup: null,
    note: null,
    repsMin: null,
    repsMax: null,
    restS: null,
    planNote: null,
  })
}

function newSet(workoutId: string, position: number, workoutExerciseId = BENCH) {
  return repos.workoutSets.create({
    workoutExerciseId,
    workoutId,
    exerciseId: BENCH,
    position,
    kind: 'working',
    weightKg: 60,
    reps: 8,
    rpe: null,
    completedAt: clock.toISOString(),
  })
}

async function outboxRows() {
  return (await db.outbox.orderBy('seq').toArray()).map(({ table, rowId }) => ({ table, rowId }))
}

describe('create', () => {
  it('sets the shared row fields from the clock and leaves userId null', async () => {
    const row = await repos.exercises.create(exercise)
    expect(row).toMatchObject({
      userId: null,
      createdAt: start.toISOString(),
      updatedAt: start.toISOString(),
      deletedAt: null,
    })
    expect(Number.parseInt(row.id.replace(/-/g, '').slice(0, 12), 16)).toBe(start.getTime())
    expect(await db.exercises.get(row.id)).toEqual(row)
  })

  it('adds one outbox entry naming the row', async () => {
    const row = await repos.exercises.create(exercise)
    expect(await outboxRows()).toEqual([{ table: 'exercises', rowId: row.id }])
  })

  it('writes neither the row nor an outbox entry when validation fails', async () => {
    await expect(repos.exercises.create({ ...exercise, nameZh: null })).rejects.toThrow()
    expect(await db.exercises.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('update', () => {
  it('changes the given fields, keeps createdAt and moves updatedAt to now', async () => {
    const created = await repos.exercises.create(exercise)
    advance(60_000)
    const updated = await repos.exercises.update(created.id, { defaultRestS: 90 })
    expect(updated).toEqual({ ...created, defaultRestS: 90, updatedAt: clock.toISOString() })
    expect(await db.exercises.get(created.id)).toEqual(updated)
    expect(await outboxRows()).toEqual([
      { table: 'exercises', rowId: created.id },
      { table: 'exercises', rowId: created.id },
    ])
  })

  it('still moves updatedAt forward when the device clock went back', async () => {
    const created = await repos.exercises.create(exercise)
    advance(-3_600_000)
    const updated = await repos.exercises.update(created.id, { defaultRestS: 90 })
    expect(updated.updatedAt).toBe('2026-11-08T10:00:00.001Z')
  })

  it('leaves the row and the outbox unchanged when validation fails', async () => {
    const created = await repos.exercises.create(exercise)
    await expect(repos.exercises.update(created.id, { defaultRestS: -1 })).rejects.toThrow()
    expect(await db.exercises.get(created.id)).toEqual(created)
    expect(await db.outbox.count()).toBe(1)
  })

  it('rejects a missing or deleted row', async () => {
    const created = await repos.exercises.create(exercise)
    await repos.exercises.remove(created.id)
    await expect(repos.exercises.update(created.id, { defaultRestS: 90 })).rejects.toThrow()
    await expect(
      repos.exercises.update('01960000-0000-7000-8000-00000000ffff', { defaultRestS: 90 }),
    ).rejects.toThrow()
  })
})

describe('remove', () => {
  it('keeps the row as a tombstone that reads as missing', async () => {
    const created = await repos.exercises.create(exercise)
    advance(1000)
    await repos.exercises.remove(created.id)
    expect(await repos.exercises.get(created.id)).toBeUndefined()
    expect(await db.exercises.get(created.id)).toEqual({
      ...created,
      deletedAt: clock.toISOString(),
      updatedAt: clock.toISOString(),
    })
    expect(await db.outbox.count()).toBe(2)
  })

  it('does nothing for a row that is already deleted', async () => {
    const created = await repos.exercises.create(exercise)
    await repos.exercises.remove(created.id)
    await repos.exercises.remove(created.id)
    expect(await db.outbox.count()).toBe(2)
  })

  it("soft-deletes a workout's sets in the same change, and no other workout's", async () => {
    const workout = await newWorkout()
    const other = await newWorkout()
    const sets = [await newSet(workout.id, 0), await newSet(workout.id, 1)]
    const otherSet = await newSet(other.id, 0)
    await db.outbox.clear()
    advance(1000)

    await repos.workouts.remove(workout.id)

    for (const set of sets) {
      expect((await db.workoutSets.get(set.id))?.deletedAt).toBe(clock.toISOString())
    }
    expect((await db.workoutSets.get(otherSet.id))?.deletedAt).toBeNull()
    // The parent first; its children in any order.
    const [parentEntry, ...childEntries] = await outboxRows()
    expect(parentEntry).toEqual({ table: 'workouts', rowId: workout.id })
    expect(childEntries).toHaveLength(sets.length)
    expect(childEntries).toEqual(
      expect.arrayContaining(sets.map((set) => ({ table: 'workoutSets', rowId: set.id }))),
    )
  })

  it("soft-deletes a workout's exercise slots with it", async () => {
    const workout = await newWorkout()
    const slot = await newSlot(workout.id, 0)
    await repos.workouts.remove(workout.id)
    expect(await repos.workoutExercises.get(slot.id)).toBeUndefined()
  })

  it("soft-deletes a slot's sets, and no other slot's", async () => {
    const workout = await newWorkout()
    const slot = await newSlot(workout.id, 0)
    const other = await newSlot(workout.id, 1)
    const set = await newSet(workout.id, 0, slot.id)
    const otherSet = await newSet(workout.id, 0, other.id)

    await repos.workoutExercises.remove(slot.id)

    expect(await repos.workoutSets.get(set.id)).toBeUndefined()
    expect(await repos.workoutSets.get(otherSet.id)).toEqual(otherSet)
    expect(await repos.workouts.get(workout.id)).toEqual(workout)
  })

  it("soft-deletes a plan's days and items, and a day's items", async () => {
    const plan = await repos.plans.create({ name: 'Push Pull Legs' })
    const newDay = (name: string, position: number) =>
      repos.planDays.create({ planId: plan.id, name, position })
    const newItem = (planDayId: string) =>
      repos.planItems.create({
        planId: plan.id,
        planDayId,
        exerciseId: BENCH,
        position: 0,
        supersetGroup: null,
        targetSets: 3,
        repsMin: 8,
        repsMax: 12,
        restS: null,
        note: null,
      })
    const push = await newDay('Push', 0)
    const pull = await newDay('Pull', 1)
    const pushItem = await newItem(push.id)
    const pullItem = await newItem(pull.id)

    await repos.planDays.remove(push.id)
    expect(await repos.planItems.get(pushItem.id)).toBeUndefined()
    expect(await repos.planItems.get(pullItem.id)).toEqual(pullItem)

    await repos.plans.remove(plan.id)
    expect(await repos.planDays.get(pull.id)).toBeUndefined()
    expect(await repos.planItems.get(pullItem.id)).toBeUndefined()
  })
})

describe('nextUpdatedAt', () => {
  it('uses the current time when it is later than the stored value', () => {
    expect(nextUpdatedAt('2026-11-08T10:00:00.000Z', new Date('2026-11-08T10:00:05.000Z'))).toBe(
      '2026-11-08T10:00:05.000Z',
    )
  })

  it('adds one millisecond when the current time is not later', () => {
    expect(nextUpdatedAt('2026-11-08T10:00:00.000Z', new Date('2026-11-08T10:00:00.000Z'))).toBe(
      '2026-11-08T10:00:00.001Z',
    )
  })
})
