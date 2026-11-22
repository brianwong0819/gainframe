import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadSession, saveSession } from './auth-session'
import { GainframeDb } from './schema'

let db: GainframeDb

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
})

afterEach(() => {
  db.close()
})

const session = {
  userId: 'sub-1',
  email: 'someone@example.com',
  accessToken: 'access',
  accessExpiresAt: '2026-11-22T07:00:00.000Z',
  refreshToken: 'refresh',
  expired: false,
}

describe('auth session', () => {
  it('is signed out on a new device', async () => {
    await expect(loadSession(db)).resolves.toBeNull()
  })

  it('reads back the saved session', async () => {
    await saveSession(db, session)
    await expect(loadSession(db)).resolves.toEqual(session)
  })

  it('treats a stored value that no longer fits the schema as signed out', async () => {
    await db.settings.put({ key: 'authSession', value: '{"userId":"sub-1"}' })
    await expect(loadSession(db)).resolves.toBeNull()
    await db.settings.put({ key: 'authSession', value: 'not json' })
    await expect(loadSession(db)).resolves.toBeNull()
  })
})
