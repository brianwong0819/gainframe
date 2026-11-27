import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clearAllData } from './clear'
import { createRepositories } from './repositories'
import { GainframeDb } from './schema'

let db: GainframeDb

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
})

afterEach(() => {
  db.close()
})

describe('clearAllData', () => {
  it('empties every table, the outbox and error log included, and keeps the database usable', async () => {
    const repos = createRepositories(db, () => new Date('2026-11-16T03:00:00.000Z'))
    await repos.exercises.create({
      nameZh: '上斜哑铃卧推',
      nameEn: null,
      muscle: 'chest',
      secondaryMuscles: [],
      equipment: 'dumbbell',
      defaultRestS: 120,
    })
    await db.settings.put({ key: 'signInCardDismissed', value: 'true' })
    await db.errors.add({
      source: 'error',
      message: 'boom',
      stack: null,
      route: '/',
      release: 'test',
      at: '2026-11-16T02:00:00.000Z',
    })
    expect(await db.outbox.count()).toBeGreaterThan(0)

    await clearAllData(db)

    const counts = await Promise.all(db.tables.map((table) => table.count()))
    expect(counts.every((count) => count === 0)).toBe(true)
    expect(db.verno).toBeGreaterThan(1)
    await db.settings.put({ key: 'signInCardDismissed', value: 'false' })
    expect(await db.settings.count()).toBe(1)
  })

  it('keeps the session when asked, and forgets the sync cursor', async () => {
    await db.settings.bulkPut([
      { key: 'authSession', value: '{"userId":"sub-1"}' },
      { key: 'syncCursor', value: '{"userId":"sub-1","cursor":9}' },
      { key: 'signInCardDismissed', value: 'true' },
    ])
    await db.outbox.add({ table: 'exercises', rowId: 'row-1' })

    await clearAllData(db, { keepSession: true })

    expect(await db.settings.toArray()).toEqual([
      { key: 'authSession', value: '{"userId":"sub-1"}' },
    ])
    expect(await db.outbox.count()).toBe(0)
  })
})
