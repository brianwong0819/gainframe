import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { saveSession } from './auth-session'
import { exportData, exportFileName } from './export'
import { createRepositories } from './repositories'
import { GainframeDb } from './schema'

let db: GainframeDb
let repos: ReturnType<typeof createRepositories>

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  repos = createRepositories(db, () => new Date('2026-11-16T03:00:00.000Z'))
})

afterEach(() => {
  db.close()
})

function newExercise(nameZh: string) {
  return repos.exercises.create({
    nameZh,
    nameEn: null,
    muscle: 'chest',
    secondaryMuscles: [],
    equipment: 'dumbbell',
    defaultRestS: 120,
  })
}

describe('exportData', () => {
  it('leaves out the signed-in session, whose tokens must not leave the app, and the sync settings', async () => {
    await db.settings.put({ key: 'activePlanId', value: 'plan-1' })
    await db.settings.put({ key: 'syncCursor', value: '{"userId":"sub-1","cursor":3}' })
    await db.settings.put({ key: 'lastSyncAt', value: '2026-11-16T03:00:00.000Z' })
    await saveSession(db, {
      userId: 'sub-1',
      email: 'someone@example.com',
      accessToken: 'access',
      accessExpiresAt: '2026-11-16T04:00:00.000Z',
      refreshToken: 'refresh',
      expired: false,
      method: 'email',
    })

    const data = await exportData(db, 'abc1234', '2026-11-16T03:05:00.000Z')

    expect(data.tables.settings).toEqual([{ key: 'activePlanId', value: 'plan-1' }])
  })

  it('copies every data table, deleted rows included, and leaves out the outbox and error log', async () => {
    const kept = await newExercise('上斜哑铃卧推')
    const removed = await newExercise('哑铃飞鸟')
    await repos.exercises.remove(removed.id)
    await db.settings.put({ key: 'activePlanId', value: 'plan-1' })
    await db.errors.add({
      source: 'error',
      message: 'boom',
      stack: null,
      route: '/',
      release: 'test',
      at: '2026-11-16T02:00:00.000Z',
    })

    const data = await exportData(db, 'abc1234', '2026-11-16T03:05:00.000Z')

    expect(data).toMatchObject({
      format: 'gainframe-export',
      formatVersion: 1,
      databaseVersion: db.verno,
      release: 'abc1234',
      exportedAt: '2026-11-16T03:05:00.000Z',
    })
    expect(data.tables.exercises.map((row) => [row.id, row.deletedAt !== null])).toEqual(
      expect.arrayContaining([
        [kept.id, false],
        [removed.id, true],
      ]),
    )
    expect(data.tables.settings).toEqual([{ key: 'activePlanId', value: 'plan-1' }])
    expect(Object.keys(data.tables).sort()).toEqual([
      'bodyMetrics',
      'exercises',
      'foods',
      'mealItems',
      'meals',
      'planDays',
      'planItems',
      'plans',
      'profiles',
      'settings',
      'workoutExercises',
      'workoutSets',
      'workouts',
    ])
  })

  it('round-trips through JSON unchanged', async () => {
    await newExercise('上斜哑铃卧推')
    const data = await exportData(db, 'abc1234', '2026-11-16T03:05:00.000Z')
    expect(JSON.parse(JSON.stringify(data))).toEqual(data)
  })
})

describe('exportFileName', () => {
  it('dates the file on the device calendar, not in UTC', () => {
    // 23:30 UTC on the 15th is already the 16th in Kuala Lumpur.
    expect(exportFileName('2026-11-15T23:30:00.000Z', 'Asia/Kuala_Lumpur')).toBe(
      'gainframe-2026-11-16.json',
    )
    expect(exportFileName('2026-11-15T23:30:00.000Z', 'America/Los_Angeles')).toBe(
      'gainframe-2026-11-15.json',
    )
  })
})
