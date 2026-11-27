import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { liveBodyMetrics, saveWeighIn } from './body-metrics'
import { createRepositories } from './repositories'
import { GainframeDb } from './schema'

let db: GainframeDb
let repos: ReturnType<typeof createRepositories>

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  repos = createRepositories(db, () => new Date('2026-11-24T00:00:00.000Z'))
})

afterEach(() => {
  db.close()
})

const weightOnly = { bodyFatPct: null, skeletalMuscleKg: null }
const timeZone = 'Asia/Kuala_Lumpur'

describe('saveWeighIn', () => {
  it('stores the weigh-in for the local day, with an outbox entry', async () => {
    const saved = await saveWeighIn(db, repos, {
      weightKg: 62.4,
      ...weightOnly,
      measuredAt: '2026-11-23T23:30:00.000Z',
      timeZone,
    })
    expect(saved).toMatchObject({ localDate: '2026-11-24', weightKg: 62.4, source: 'manual' })
    expect(await db.outbox.count()).toBe(1)
  })

  it('corrects the same day instead of adding a second row', async () => {
    await saveWeighIn(db, repos, {
      weightKg: 62.4,
      ...weightOnly,
      measuredAt: '2026-11-24T00:30:00.000Z',
      timeZone,
    })
    await saveWeighIn(db, repos, {
      weightKg: 62.1,
      bodyFatPct: 14.2,
      skeletalMuscleKg: 29.5,
      measuredAt: '2026-11-24T01:00:00.000Z',
      timeZone,
    })
    await saveWeighIn(db, repos, {
      weightKg: 62.6,
      ...weightOnly,
      measuredAt: '2026-11-25T00:30:00.000Z',
      timeZone,
    })
    const rows = await liveBodyMetrics(db)
    expect(
      rows.map(({ localDate, weightKg, bodyFatPct }) => [localDate, weightKg, bodyFatPct]),
    ).toEqual([
      ['2026-11-24', 62.1, 14.2],
      ['2026-11-25', 62.6, null],
    ])
  })
})
