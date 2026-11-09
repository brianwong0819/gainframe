import { Dexie } from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'

import { GainframeDb, STORES_V1 } from './schema'

// Data on the phone cannot be repaired from the server, so every schema
// version is opened over a database written by the version before it.
describe('Dexie schema upgrades', () => {
  it('keeps version 1 rows when upgrading to version 2', async () => {
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

    const v2 = new GainframeDb('upgrade', options)
    expect(await v2.workouts.get(workout.id)).toEqual(workout)
    expect(await v2.outbox.toArray()).toEqual([{ seq: 1, table: 'workouts', rowId: workout.id }])
    expect(await v2.errors.count()).toBe(0)
    expect(v2.verno).toBe(2)
    v2.close()
  })
})
