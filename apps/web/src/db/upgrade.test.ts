import { Dexie } from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'

import { GainframeDb, STORES_V1 } from './schema'

// Data on the phone cannot be repaired from the server, so every schema
// version is opened over a database written by the version before it.
describe('Dexie schema upgrades', () => {
  it('keeps version 1 rows when upgrading', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v1 = new Dexie('upgrade', options)
    v1.version(1).stores(STORES_V1)
    const workout = {
      id: '01960000-0000-7000-8000-000000000001',
      userId: null,
      createdAt: '2026-11-08T10:00:00.000Z',
      updatedAt: '2026-11-08T10:00:00.000Z',
      deletedAt: null,
      startedAt: '2026-11-08T10:00:00.000Z',
      endedAt: null,
      templateId: null,
      localDate: '2026-11-08',
      note: null,
    }
    await v1.table('workouts').add(workout)
    await v1.table('outbox').add({ table: 'workouts', rowId: workout.id })
    v1.close()

    const current = new GainframeDb('upgrade', options)
    expect(await current.workouts.get(workout.id)).toEqual(workout)
    expect(await current.outbox.toArray()).toEqual([
      { seq: 1, table: 'workouts', rowId: workout.id },
    ])
    expect(await current.errors.count()).toBe(0)
    expect(current.verno).toBe(3)
    current.close()
  })

  it('gives version 2 custom exercises no secondary muscles in version 3', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v2 = new Dexie('upgrade', options)
    v2.version(1).stores(STORES_V1)
    v2.version(2).stores({ errors: '++seq' })
    const exercise = {
      id: '01960000-0000-7000-8000-000000000002',
      userId: null,
      createdAt: '2026-11-08T10:00:00.000Z',
      updatedAt: '2026-11-08T10:00:00.000Z',
      deletedAt: null,
      nameZh: '地雷管推举',
      nameEn: null,
      muscle: 'shoulders',
      equipment: 'barbell',
      defaultRestS: 90,
    }
    await v2.table('exercises').add(exercise)
    v2.close()

    const v3 = new GainframeDb('upgrade', options)
    expect(await v3.exercises.get(exercise.id)).toEqual({ ...exercise, secondaryMuscles: [] })
    expect(await v3.outbox.count()).toBe(0)
    expect(v3.verno).toBe(3)
    v3.close()
  })
})
