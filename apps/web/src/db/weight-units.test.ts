import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clearAllData } from './clear'
import { createRepositories, type Repositories } from './repositories'
import { GainframeDb } from './schema'
import { applyPulledPage } from './sync'
import { createWeightUnitStore } from './weight-units'

const BENCH = '00000000-0000-7000-8000-000000000001'
const PRESS = '00000000-0000-7000-8000-000000000002'

const SESSION = {
  userId: 'sub-1',
  email: 'someone@example.com',
  accessToken: 'access',
  accessExpiresAt: '2026-11-27T11:00:00.000Z',
  refreshToken: 'refresh',
  expired: false,
  method: 'email',
}

let db: GainframeDb
let repos: Repositories
let clock: Date
let units: ReturnType<typeof createWeightUnitStore>

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  clock = new Date('2026-11-27T10:00:00.000Z')
  repos = createRepositories(db, () => clock)
  units = createWeightUnitStore(db, repos)
})

afterEach(() => {
  db.close()
})

describe('weight units', () => {
  it('keeps pounds per exercise and shows an exercise switched back to kg as kg', async () => {
    expect(await units.all()).toEqual(new Map())
    await units.set(BENCH, 'lb')
    await units.set(PRESS, 'lb')
    clock = new Date('2026-11-27T10:01:00.000Z')
    await units.set(PRESS, 'kg')
    expect(await units.all()).toEqual(new Map([[BENCH, 'lb']]))
    expect(await db.exerciseUnits.count()).toBe(2)
  })

  it('writes nothing for kg on an exercise without a unit', async () => {
    await units.set(BENCH, 'kg')
    expect(await db.exerciseUnits.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('queues each change for backup', async () => {
    await units.set(BENCH, 'lb')
    await units.set(BENCH, 'lb')
    expect(await db.outbox.count()).toBe(1)
    await units.set(BENCH, 'kg')
    expect(await db.outbox.count()).toBe(2)
  })

  it('uses the most recently updated row when two devices each made one', async () => {
    const row = (id: string, updatedAt: string, weightUnit: 'kg' | 'lb') => ({
      id,
      userId: null,
      createdAt: updatedAt,
      updatedAt,
      deletedAt: null,
      exerciseId: BENCH,
      weightUnit,
    })
    await db.exerciseUnits.bulkAdd([
      row('00000000-0000-7000-8000-0000000000a1', '2026-11-27T10:00:00.000Z', 'lb'),
      row('00000000-0000-7000-8000-0000000000a2', '2026-11-27T11:00:00.000Z', 'kg'),
    ])
    expect(await units.all()).toEqual(new Map())
  })

  it('comes back after the device is cleared and downloads the account again', async () => {
    await units.set(BENCH, 'lb')
    const saved = await db.exerciseUnits.toArray()
    await clearAllData(db)
    await db.settings.put({ key: 'authSession', value: JSON.stringify(SESSION) })
    expect(await units.all()).toEqual(new Map())

    await applyPulledPage(
      db,
      'sub-1',
      saved.map((row) => ({ table: 'exerciseUnits' as const, row: { ...row, userId: 'sub-1' } })),
      1,
    )
    expect(await units.all()).toEqual(new Map([[BENCH, 'lb']]))
  })
})
