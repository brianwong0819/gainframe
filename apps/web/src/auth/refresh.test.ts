import { afterEach, describe, expect, it, vi } from 'vitest'

import { needsRefresh, refreshSession, SessionExpiredError } from './refresh'

const config = { origin: 'https://gainframe-dev.auth.example.com', clientId: 'client-1' }
const NOW = new Date('2026-11-22T06:00:00.000Z')
const session = {
  userId: 'sub-1',
  email: 'someone@example.com',
  accessToken: 'access-1',
  accessExpiresAt: '2026-11-22T06:30:00.000Z',
  refreshToken: 'refresh-1',
  expired: false,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('token refresh', () => {
  it('renews a token in its last minute, not before', () => {
    expect(needsRefresh({ ...session, accessExpiresAt: '2026-11-22T06:01:01.000Z' }, NOW)).toBe(
      false,
    )
    expect(needsRefresh({ ...session, accessExpiresAt: '2026-11-22T06:01:00.000Z' }, NOW)).toBe(
      true,
    )
    expect(needsRefresh({ ...session, accessExpiresAt: '2026-11-22T05:00:00.000Z' }, NOW)).toBe(
      true,
    )
  })

  it('sends the refresh token and keeps it when Cognito does not rotate it', async () => {
    let body = new URLSearchParams()
    vi.stubGlobal('fetch', (_url: URL, init: RequestInit) => {
      if (init.body instanceof URLSearchParams) body = init.body
      return Promise.resolve(
        Response.json({ access_token: 'access-2', id_token: 'id', expires_in: 3600 }),
      )
    })

    await expect(refreshSession(config, session, NOW)).resolves.toEqual({
      ...session,
      accessToken: 'access-2',
      accessExpiresAt: '2026-11-22T07:00:00.000Z',
    })
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'refresh_token',
      client_id: 'client-1',
      refresh_token: 'refresh-1',
    })
  })

  it('takes a rotated refresh token', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        Response.json({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600 }),
      ),
    )
    const renewed = await refreshSession(config, session, NOW)
    expect(renewed.refreshToken).toBe('refresh-2')
  })

  it('ends the session when Cognito refuses the refresh token', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(Response.json({ error: 'invalid_grant' }, { status: 400 })),
    )
    await expect(refreshSession(config, session, NOW)).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it('treats other failures as worth retrying', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('busy', { status: 503 })))
    const failure = refreshSession(config, session, NOW)
    await expect(failure).rejects.toThrow('token endpoint answered 503')
    await expect(failure).rejects.not.toBeInstanceOf(SessionExpiredError)

    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Load failed')))
    await expect(refreshSession(config, session, NOW)).rejects.toThrow('Load failed')
  })
})
