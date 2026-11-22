import type { AuthSession } from '../auth/session'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  type Exercise,
  type PullResponse,
  pushRequestSchema,
  type PushResult,
} from '@gainframe/shared'
import { z } from 'zod'

import { type ApiClient, type ApiRequest, ApiRequestError, NotSignedInError } from '../api/client'
import { saveSession } from '../db/auth-session'
import { createRepositories, type NewRow } from '../db/repositories'
import { GainframeDb } from '../db/schema'
import { loadLastSync, pendingRowCount, type RejectedRow } from '../db/sync'

import { createSyncEngine, retryDelayMs } from './engine'

const NOW = new Date('2026-11-22T06:00:00.000Z')
const session: AuthSession = {
  userId: 'sub-1',
  email: 'someone@example.com',
  accessToken: 'access-1',
  accessExpiresAt: '2026-11-22T07:00:00.000Z',
  refreshToken: 'refresh-1',
  expired: false,
  method: 'email',
}
const exercise: NewRow<Exercise> = {
  nameZh: '上斜哑铃卧推',
  nameEn: null,
  muscle: 'chest',
  secondaryMuscles: [],
  equipment: 'dumbbell',
  defaultRestS: 120,
}

const idOf = z.object({ id: z.string() })

let db: GainframeDb
let requests: ApiRequest[]
let pushResult: (row: unknown) => PushResult
let pullPages: PullResponse[]
let failWith: Error | undefined
let online: boolean
let timers: number[]
let rejected: RejectedRow[]

// A server that applies every pushed row unless told otherwise and answers
// pulls with the queued pages, then with nothing.
const api: ApiClient = {
  request: (schema, request) => {
    requests.push(request)
    if (failWith !== undefined) return Promise.reject(failWith)
    const body =
      request.method === 'POST'
        ? {
            results: pushRequestSchema
              .parse(request.body)
              .rows.map((entry) => pushResult(entry.row)),
          }
        : (pullPages.shift() ?? { rows: [], cursor: 0, more: false })
    return Promise.resolve(schema.parse(body))
  },
}

function engine() {
  return createSyncEngine({
    db,
    api,
    isOnline: () => online,
    onRejected: (rows) => rejected.push(...rows),
    onUnreadable: () => undefined,
    now: () => NOW,
    setTimer: (_run, ms) => {
      timers.push(ms)
      return () => undefined
    },
  })
}

beforeEach(async () => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  requests = []
  pushResult = () => ({ status: 'applied' })
  pullPages = []
  failWith = undefined
  online = true
  timers = []
  rejected = []
  await saveSession(db, session)
})

afterEach(() => {
  db.close()
})

describe('sync engine', () => {
  it('pushes the outbox, pulls every page and records the backup', async () => {
    const repos = createRepositories(db, () => NOW)
    const mine = await repos.exercises.create(exercise)
    const remote = { ...mine, id: '019ab000-0000-7000-8000-000000000001', userId: 'sub-1' }
    pullPages = [
      { rows: [{ table: 'exercises', row: remote }], cursor: 4, more: true },
      { rows: [], cursor: 4, more: false },
    ]
    const sync = engine()

    await sync.run()
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      'POST /api/sync/push',
      'GET /api/sync/pull?cursor=0',
      'GET /api/sync/pull?cursor=4',
    ])
    expect(requests[0]?.headers).toEqual({ 'x-gainframe-sync-version': '1' })
    await expect(pendingRowCount(db)).resolves.toBe(0)
    expect(await db.exercises.get(remote.id)).toBeDefined()
    await expect(loadLastSync(db)).resolves.toBe(NOW.toISOString())
    expect(sync.getStatus()).toEqual({ phase: 'idle', failingSince: null })
  })

  it('reports rows rejected for good and stops when only held-back rows remain', async () => {
    const repos = createRepositories(db, () => NOW)
    const bad = await repos.exercises.create(exercise)
    await repos.exercises.create(exercise)
    pushResult = (row) =>
      idOf.parse(row).id === bad.id
        ? { status: 'rejected', reason: 'not_owned', issues: [] }
        : { status: 'rejected', reason: 'clock_skew', issues: [] }

    await engine().run()
    expect(rejected.map((row) => row.rowId)).toEqual([bad.id])
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(2)
    await expect(pendingRowCount(db)).resolves.toBe(1)
  })

  it('does nothing signed out and asks to sign in again once the session expired', async () => {
    await db.settings.delete('authSession')
    const sync = engine()
    await sync.run()
    expect(sync.getStatus().phase).toBe('signedOut')

    await saveSession(db, { ...session, expired: true })
    await sync.run()
    expect(sync.getStatus().phase).toBe('needsSignIn')
    expect(requests).toHaveLength(0)
  })

  it('shows a refused refresh token as needing a new sign-in', async () => {
    failWith = new NotSignedInError(true)
    const sync = engine()
    await sync.run()
    expect(sync.getStatus().phase).toBe('needsSignIn')
    expect(timers).toEqual([])
  })

  it('asks for an update when the server no longer accepts this version', async () => {
    failWith = new ApiRequestError(426, 'update_required', 'req-1')
    const sync = engine()
    await sync.run()
    expect(sync.getStatus().phase).toBe('updateRequired')
    expect(timers).toEqual([])
  })

  it('retries failures with growing delays and remembers when they began', async () => {
    failWith = new ApiRequestError(500, 'internal_error', 'req-1')
    const sync = engine()
    await sync.run()
    await sync.run()
    expect(sync.getStatus()).toEqual({ phase: 'failed', failingSince: NOW.toISOString() })
    expect(timers).toEqual([5000, 10000])

    online = false
    failWith = new TypeError('Load failed')
    await sync.run()
    expect(sync.getStatus().phase).toBe('offline')
  })

  it('caps the retry delay', () => {
    expect(retryDelayMs(1)).toBe(5000)
    expect(retryDelayMs(20)).toBe(300000)
  })

  it('runs again after a run asked for while one was going', async () => {
    const sync = engine()
    await Promise.all([sync.run(), sync.run()])
    expect(requests.filter((request) => request.method === 'GET')).toHaveLength(2)
  })
})
