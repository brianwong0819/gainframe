import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Exercise } from '@gainframe/shared'

import { saveSession } from './auth-session'
import { createRepositories, type NewRow } from './repositories'
import { GainframeDb } from './schema'
import { applyPulledPage, pendingRowCount, readCursor, readPushBatch, settlePush } from './sync'

let db: GainframeDb
let clock: Date
let repos: ReturnType<typeof createRepositories>

beforeEach(async () => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  await saveSession(db, {
    userId: 'sub-1',
    email: 'someone@example.com',
    accessToken: 'access',
    accessExpiresAt: '2026-11-22T07:00:00.000Z',
    refreshToken: 'refresh',
    expired: false,
  })
  clock = new Date('2026-11-22T06:00:00.000Z')
  repos = createRepositories(db, () => clock)
})

afterEach(() => {
  db.close()
})

const exercise: NewRow<Exercise> = {
  nameZh: '上斜哑铃卧推',
  nameEn: null,
  muscle: 'chest',
  secondaryMuscles: [],
  equipment: 'dumbbell',
  defaultRestS: 120,
}

function tick() {
  clock = new Date(clock.getTime() + 1000)
}

describe('push batch', () => {
  it('sends each changed row once, with its current values, in first-change order', async () => {
    const first = await repos.exercises.create(exercise)
    tick()
    const second = await repos.exercises.create({ ...exercise, nameZh: '二' })
    tick()
    await repos.exercises.update(first.id, { defaultRestS: 90 })

    const batch = await readPushBatch(db, 200)
    expect(batch.map((entry) => [entry.rowId, entry.maxSeq])).toEqual([
      [first.id, 3],
      [second.id, 2],
    ])
    expect(batch[0]?.row).toMatchObject({ defaultRestS: 90 })
    await expect(pendingRowCount(db)).resolves.toBe(2)
  })

  it('stops at the batch limit', async () => {
    await repos.exercises.create(exercise)
    await repos.exercises.create(exercise)
    await expect(readPushBatch(db, 1)).resolves.toHaveLength(1)
  })

  it('keeps a change made while the push was on its way', async () => {
    const row = await repos.exercises.create(exercise)
    const batch = await readPushBatch(db, 200)
    tick()
    await repos.exercises.update(row.id, { defaultRestS: 60 })

    await settlePush(db, batch, [{ status: 'applied' }])
    await expect(pendingRowCount(db)).resolves.toBe(1)
    const [next] = await readPushBatch(db, 200)
    expect(next?.row).toMatchObject({ defaultRestS: 60 })
  })

  it('drops rows rejected for good and keeps rows rejected for clock skew', async () => {
    const invalid = await repos.exercises.create(exercise)
    const ahead = await repos.exercises.create(exercise)
    await repos.exercises.create(exercise)
    const batch = await readPushBatch(db, 200)

    const { removed, rejected } = await settlePush(db, batch, [
      { status: 'rejected', reason: 'invalid', issues: ['defaultRestS'] },
      { status: 'rejected', reason: 'clock_skew', issues: [] },
      { status: 'ignored' },
    ])
    expect(removed).toBe(2)
    expect(rejected.map((row) => row.rowId)).toEqual([invalid.id])
    expect((await readPushBatch(db, 200)).map((entry) => entry.rowId)).toEqual([ahead.id])
    expect(await db.exercises.get(invalid.id)).toBeDefined()
  })

  it('drops entries whose row is gone', async () => {
    await db.outbox.add({ table: 'exercises', rowId: 'missing' })
    await expect(readPushBatch(db, 200)).resolves.toEqual([])
    await expect(db.outbox.count()).resolves.toBe(0)
  })
})

describe('pulled page', () => {
  it('applies newer rows without queueing them, keeps newer local ones, and stores the cursor', async () => {
    const local = await repos.exercises.create(exercise)
    await db.outbox.clear()
    const remoteId = '019ab000-0000-7000-8000-000000000001'
    const remote = { ...local, id: remoteId, userId: 'sub-1', nameZh: '远程' }
    const older = { ...local, userId: 'sub-1', nameZh: '旧', updatedAt: '2026-11-21T00:00:00.000Z' }

    const invalid = await applyPulledPage(
      db,
      'sub-1',
      [
        { table: 'exercises', row: remote },
        { table: 'exercises', row: older },
        { table: 'exercises', row: { id: 'bad' } },
      ],
      7,
    )
    expect(invalid).toHaveLength(1)
    expect(await db.exercises.get(remoteId)).toMatchObject({ nameZh: '远程' })
    expect(await db.exercises.get(local.id)).toMatchObject({ nameZh: '上斜哑铃卧推' })
    await expect(db.outbox.count()).resolves.toBe(0)
    await expect(readCursor(db, 'sub-1')).resolves.toBe(7)
  })

  it('replaces a local row with a later version', async () => {
    const local = await repos.exercises.create(exercise)
    const later = { ...local, userId: 'sub-1', nameZh: '新', updatedAt: '2026-11-22T07:00:00.000Z' }

    await applyPulledPage(db, 'sub-1', [{ table: 'exercises', row: later }], 1)
    expect(await db.exercises.get(local.id)).toMatchObject({ nameZh: '新' })
  })

  it('starts from the beginning for another account', async () => {
    await applyPulledPage(db, 'sub-1', [], 9)
    await expect(readCursor(db, 'sub-2')).resolves.toBe(0)
  })

  it('writes nothing once the account has signed out', async () => {
    const local = await repos.exercises.create(exercise)
    await db.settings.delete('authSession')

    await expect(
      applyPulledPage(
        db,
        'sub-1',
        [{ table: 'exercises', row: { ...local, id: '019ab000-0000-7000-8000-000000000002' } }],
        3,
      ),
    ).rejects.toThrow('no longer signed in')
    await expect(db.exercises.count()).resolves.toBe(1)
    await expect(readCursor(db, 'sub-1')).resolves.toBe(0)
  })
})
