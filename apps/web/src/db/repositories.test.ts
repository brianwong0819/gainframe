import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { toLocalDate } from '@gainframe/shared'

import { createRepositories, nextUpdatedAt } from './repositories'
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

const exercise = {
  nameZh: '上斜哑铃卧推',
  nameEn: null,
  muscle: 'chest',
  equipment: 'dumbbell',
  defaultRestS: 120,
} as const

function newWorkout() {
  return repos.workouts.create({
    startedAt: clock.toISOString(),
    endedAt: null,
    templateId: null,
    localDate: toLocalDate(clock.toISOString(), 'Asia/Kuala_Lumpur'),
    note: null,
  })
}

function newSet(workoutId: string, position: number) {
  return repos.workoutSets.create({
    workoutId,
    exerciseId: '01960000-0000-7000-8000-0000000000b1',
    supersetGroup: null,
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

  it("soft-deletes a template's items", async () => {
    const template = await repos.templates.create({ name: 'Push A' })
    const item = await repos.templateItems.create({
      templateId: template.id,
      exerciseId: '01960000-0000-7000-8000-0000000000b1',
      position: 0,
      supersetGroup: null,
      targetSets: 3,
      targetReps: 8,
    })
    await repos.templates.remove(template.id)
    expect(await repos.templateItems.get(item.id)).toBeUndefined()
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
