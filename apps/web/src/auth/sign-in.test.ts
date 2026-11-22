import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { finishSignIn, SignInError, startSignIn } from './sign-in'

const config = { origin: 'https://gainframe-dev.auth.example.com', clientId: 'client-1' }
const NOW = new Date('2026-11-22T06:00:00.000Z')

function idToken(claims: object): string {
  const payload = btoa(JSON.stringify(claims)).replace(/=+$/, '')
  return `header.${payload}.signature`
}

const tokenResponse = {
  access_token: 'access-1',
  id_token: idToken({ sub: 'sub-1', email: 'someone@example.com' }),
  refresh_token: 'refresh-1',
  expires_in: 3600,
  token_type: 'Bearer',
}

let assigned: string | null
const store = new Map<string, string>()

beforeEach(() => {
  assigned = null
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  })
  vi.stubGlobal('window', {
    location: {
      origin: 'https://app.example.com',
      assign: (url: string) => {
        assigned = url
      },
    },
  })
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// Starts a sign-in and returns the redirect back Cognito would send.
async function redirectBack(): Promise<URLSearchParams> {
  await startSignIn(config)
  const url = new URL(assigned ?? '')
  return new URLSearchParams({ code: 'code-1', state: url.searchParams.get('state') ?? '' })
}

describe('sign-in by redirect', () => {
  it('sends the whole page to the authorize endpoint with a PKCE challenge', async () => {
    await startSignIn(config)
    const url = new URL(assigned ?? '')

    expect(url.origin + url.pathname).toBe(`${config.origin}/oauth2/authorize`)
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://app.example.com/settings/sign-in',
      scope: 'openid email',
      code_challenge_method: 'S256',
    })
  })

  it('exchanges the code with the saved verifier and returns the session', async () => {
    let body = new URLSearchParams()
    vi.stubGlobal('fetch', (_url: URL, init: RequestInit) => {
      if (init.body instanceof URLSearchParams) body = init.body
      return Promise.resolve(Response.json(tokenResponse))
    })
    const params = await redirectBack()

    await expect(finishSignIn(config, params)).resolves.toEqual({
      userId: 'sub-1',
      email: 'someone@example.com',
      accessToken: 'access-1',
      accessExpiresAt: '2026-11-22T07:00:00.000Z',
      refreshToken: 'refresh-1',
    })
    expect(body.get('code')).toBe('code-1')
    expect(body.get('code_verifier')).toMatch(/^[\w-]{43}$/)
  })

  it('refuses a redirect whose state this device did not start', async () => {
    await redirectBack()
    const forged = new URLSearchParams({ code: 'code-1', state: 'forged' })

    await expect(finishSignIn(config, forged)).rejects.toEqual(new SignInError('no_pending'))
  })

  it('uses a pending sign-in once, so a reload of the redirect does not exchange again', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(Response.json(tokenResponse)))
    const params = await redirectBack()
    await finishSignIn(config, params)

    await expect(finishSignIn(config, params)).rejects.toEqual(new SignInError('no_pending'))
  })

  it('reports a cancelled sign-in and a refused exchange', async () => {
    await redirectBack()
    await expect(
      finishSignIn(config, new URLSearchParams({ error: 'access_denied' })),
    ).rejects.toEqual(new SignInError('denied'))

    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 400 })))
    await expect(finishSignIn(config, await redirectBack())).rejects.toEqual(
      new SignInError('exchange'),
    )
  })
})
