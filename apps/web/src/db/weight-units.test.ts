import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GainframeDb } from './schema'
import { createWeightUnitStore } from './weight-units'

const BENCH = '00000000-0000-7000-8000-000000000001'
const PRESS = '00000000-0000-7000-8000-000000000002'

let db: GainframeDb
let units: ReturnType<typeof createWeightUnitStore>

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  units = createWeightUnitStore(db)
})

afterEach(() => {
  db.close()
})

describe('weight units', () => {
  it('keeps pounds per exercise and forgets an exercise switched back to kg', async () => {
    expect(await units.all()).toEqual(new Map())
    await units.set(BENCH, 'lb')
    await units.set(PRESS, 'lb')
    await units.set(PRESS, 'kg')
    expect(await units.all()).toEqual(new Map([[BENCH, 'lb']]))
    expect(await db.settings.count()).toBe(1)
  })

  it('leaves the active plan setting alone', async () => {
    await db.settings.put({ key: 'activePlanId', value: 'plan' })
    await units.set(BENCH, 'lb')
    expect(await units.all()).toEqual(new Map([[BENCH, 'lb']]))
  })

  it('ignores a stored value that is not a unit', async () => {
    await db.settings.put({ key: `weightUnit:${BENCH}`, value: 'stone' })
    expect(await units.all()).toEqual(new Map())
  })
})
