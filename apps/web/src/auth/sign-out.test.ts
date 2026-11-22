import { afterEach, describe, expect, it, vi } from 'vitest'

import { logoutUrl, revokeRefreshToken } from './sign-out'

const config = { origin: 'https://gainframe-dev.auth.example.com', clientId: 'client-1' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sign-out', () => {
  it('revokes the refresh token for this client', async () => {
    let url = ''
    let body = new URLSearchParams()
    vi.stubGlobal('fetch', (target: URL, init: RequestInit) => {
      url = target.toString()
      if (init.body instanceof URLSearchParams) body = init.body
      return Promise.resolve(new Response(null))
    })

    await revokeRefreshToken(config, 'refresh-1')
    expect(url).toBe(`${config.origin}/oauth2/revoke`)
    expect(Object.fromEntries(body)).toEqual({ token: 'refresh-1', client_id: 'client-1' })
  })

  it('carries on when Cognito cannot be reached', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Load failed')))
    await expect(revokeRefreshToken(config, 'refresh-1')).resolves.toBeUndefined()
  })

  it('returns to Settings after managed login clears its cookie', () => {
    const url = new URL(logoutUrl(config, 'https://app.example.com'))
    expect(url.origin + url.pathname).toBe(`${config.origin}/logout`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-1',
      logout_uri: 'https://app.example.com/settings',
    })
  })
})
