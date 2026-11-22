import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type { AuthSession } from '../auth/session'
import { loadSession, saveSession } from '../db/auth-session'
import { GainframeDb } from '../db/schema'

import { ApiRequestError, createApiClient, NotSignedInError } from './client'

const config = { origin: 'https://gainframe-dev.auth.example.com', clientId: 'client-1' }
const NOW = new Date('2026-11-22T06:00:00.000Z')
const session: AuthSession = {
  userId: 'sub-1',
  email: 'someone@example.com',
  accessToken: 'access-1',
  accessExpiresAt: '2026-11-22T06:30:00.000Z',
  refreshToken: 'refresh-1',
  expired: false,
}
const okSchema = z.object({ ok: z.boolean() })

interface Call {
  url: string
  init: RequestInit
}

let db: GainframeDb
let calls: Call[]
let failures: string[]

// Answers the token endpoint with `token` and every API path with `api`.
function stubFetch(api: (call: Call) => Response, token?: () => Response) {
  vi.stubGlobal('fetch', (url: URL | string, init: RequestInit) => {
    const call = { url: url.toString(), init }
    calls.push(call)
    if (call.url.endsWith('/oauth2/token')) {
      return Promise.resolve(token?.() ?? new Response(null, { status: 500 }))
    }
    return Promise.resolve(api(call))
  })
}

function client() {
  return createApiClient({
    db,
    config,
    onFailure: (message) => failures.push(message),
    now: () => NOW,
  })
}

const headerOf = (call: Call | undefined, name: string) => new Headers(call?.init.headers).get(name)
const apiCalls = () => calls.filter((call) => call.url.startsWith('/api'))

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  calls = []
  failures = []
})

afterEach(() => {
  db.close()
  vi.unstubAllGlobals()
})

describe('API client', () => {
  it('sends the access token, and the body hash on a POST', async () => {
    await saveSession(db, session)
    stubFetch(() => Response.json({ ok: true }))

    await expect(
      client().request(okSchema, { method: 'POST', path: '/api/sync/push', body: { a: 1 } }),
    ).resolves.toEqual({ ok: true })
    const [call] = apiCalls()
    expect(headerOf(call, 'x-gainframe-token')).toBe('access-1')
    expect(call?.init.body).toBe('{"a":1}')
    // SHA-256 of the exact bytes `{"a":1}`.
    expect(headerOf(call, 'x-amz-content-sha256')).toBe(
      '015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862',
    )
  })

  it('sends no body hash on a GET', async () => {
    await saveSession(db, session)
    stubFetch(() => Response.json({ ok: true }))

    await client().request(okSchema, { method: 'GET', path: '/api/sync/pull?cursor=0' })
    expect(headerOf(apiCalls()[0], 'x-amz-content-sha256')).toBeNull()
  })

  it('renews a token about to expire once for requests sent together, and saves it', async () => {
    await saveSession(db, { ...session, accessExpiresAt: '2026-11-22T06:00:30.000Z' })
    stubFetch(
      () => Response.json({ ok: true }),
      () => Response.json({ access_token: 'access-2', expires_in: 3600 }),
    )
    const api = client()

    await Promise.all([
      api.request(okSchema, { method: 'GET', path: '/api/a' }),
      api.request(okSchema, { method: 'GET', path: '/api/b' }),
    ])
    expect(calls.filter((call) => call.url.endsWith('/oauth2/token'))).toHaveLength(1)
    expect(apiCalls().map((call) => headerOf(call, 'x-gainframe-token'))).toEqual([
      'access-2',
      'access-2',
    ])
    await expect(loadSession(db)).resolves.toMatchObject({
      accessToken: 'access-2',
      accessExpiresAt: '2026-11-22T07:00:00.000Z',
    })
  })

  it('marks the session expired when Cognito refuses the refresh token', async () => {
    await saveSession(db, { ...session, accessExpiresAt: '2026-11-22T05:00:00.000Z' })
    stubFetch(
      () => Response.json({ ok: true }),
      () => Response.json({ error: 'invalid_grant' }, { status: 400 }),
    )

    await expect(client().request(okSchema, { method: 'GET', path: '/api/a' })).rejects.toEqual(
      new NotSignedInError(true),
    )
    expect(apiCalls()).toHaveLength(0)
    await expect(loadSession(db)).resolves.toMatchObject({ email: session.email, expired: true })
  })

  it('does not bring back a session signed out during the refresh', async () => {
    await saveSession(db, { ...session, accessExpiresAt: '2026-11-22T05:00:00.000Z' })
    stubFetch(
      () => Response.json({ ok: true }),
      () => {
        void db.settings.delete('authSession')
        return Response.json({ access_token: 'access-2', expires_in: 3600 })
      },
    )

    await client().request(okSchema, { method: 'GET', path: '/api/a' })
    await expect(loadSession(db)).resolves.toBeNull()
  })

  it('sends nothing without a session or with an expired one', async () => {
    stubFetch(() => Response.json({ ok: true }))
    await expect(client().request(okSchema, { method: 'GET', path: '/api/a' })).rejects.toEqual(
      new NotSignedInError(false),
    )

    await saveSession(db, { ...session, expired: true })
    await expect(client().request(okSchema, { method: 'GET', path: '/api/a' })).rejects.toEqual(
      new NotSignedInError(true),
    )
    expect(calls).toHaveLength(0)
  })

  it('renews the token and tries once more when the API refuses it', async () => {
    await saveSession(db, session)
    stubFetch(
      (call) =>
        headerOf(call, 'x-gainframe-token') === 'access-1'
          ? new Response(null, { status: 401 })
          : Response.json({ ok: true }),
      () => Response.json({ access_token: 'access-2', expires_in: 3600 }),
    )

    await expect(client().request(okSchema, { method: 'GET', path: '/api/a' })).resolves.toEqual({
      ok: true,
    })
    expect(apiCalls()).toHaveLength(2)
  })

  it('reports an error status with its code and request ID', async () => {
    await saveSession(db, session)
    stubFetch(() =>
      Response.json(
        { error: { code: 'update_required', message: 'Update', requestId: 'req-1' } },
        { status: 426, headers: { 'x-request-id': 'req-1' } },
      ),
    )

    await expect(
      client().request(okSchema, { method: 'GET', path: '/api/sync/pull?cursor=5' }),
    ).rejects.toEqual(new ApiRequestError(426, 'update_required', 'req-1'))
    expect(failures).toEqual(['GET /api/sync/pull answered 426 (request req-1)'])
  })
})
