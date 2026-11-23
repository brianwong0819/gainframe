import { apiErrorSchema, TOKEN_HEADER, tokenHeaderValue } from '@gainframe/shared'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { describe, expect, it, vi } from 'vitest'

import { type AuthConfig, createKeyCache, type Jwks, requireUser } from './auth.ts'
import type { AppEnv } from './context.ts'

const config: AuthConfig = {
  issuer: 'https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_test',
  clientId: 'web-client',
}

async function keyPair(kid: string) {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  return {
    signingKey: { ...privateJwk, kid, alg: 'RS256' },
    publicKey: {
      kid,
      kty: 'RSA' as const,
      alg: 'RS256',
      n: publicJwk.n ?? '',
      e: publicJwk.e ?? '',
    },
  }
}

const now = () => Math.floor(Date.now() / 1000)

// An access token shaped like Cognito's.
function claims(overrides: Record<string, unknown> = {}) {
  return {
    sub: 'user-a',
    username: 'user-a',
    iss: config.issuer,
    client_id: config.clientId,
    token_use: 'access',
    scope: 'openid email',
    iat: now(),
    exp: now() + 3600,
    ...overrides,
  }
}

async function setup() {
  const { signingKey, publicKey } = await keyPair('key-1')
  const keys: Jwks = [publicKey]
  const app = new Hono<AppEnv>()
  app.use(async (c, next) => {
    c.set('requestId', 'req-1')
    await next()
  })
  app.use(requireUser(config, () => Promise.resolve(keys)))
  app.get('/whoami', (c) => c.json({ userId: c.var.userId }))
  const call = (token: string | null) =>
    app.request('/whoami', {
      headers: token === null ? {} : { [TOKEN_HEADER]: tokenHeaderValue(token) },
    })
  return { signingKey, call }
}

async function expectUnauthorized(response: Response) {
  expect(response.status).toBe(401)
  expect(apiErrorSchema.parse(await response.json()).error).toEqual({
    code: 'unauthorized',
    message: 'Sign-in required',
    requestId: 'req-1',
  })
}

describe('requireUser', () => {
  it("takes the user ID from a valid access token's sub", async () => {
    const { signingKey, call } = await setup()
    const response = await call(await sign(claims(), signingKey))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ userId: 'user-a' })
  })

  it('rejects a request without a token', async () => {
    const { call } = await setup()
    await expectUnauthorized(await call(null))
  })

  it('rejects a token that is not a JWT', async () => {
    const { call } = await setup()
    await expectUnauthorized(await call('not-a-token'))
  })

  it('rejects an expired token', async () => {
    const { signingKey, call } = await setup()
    await expectUnauthorized(await call(await sign(claims({ exp: now() - 1 }), signingKey)))
  })

  it('rejects a token without an expiry, which would never expire', async () => {
    const { signingKey, call } = await setup()
    await expectUnauthorized(await call(await sign(claims({ exp: undefined }), signingKey)))
  })

  it('rejects a token from another issuer', async () => {
    const { signingKey, call } = await setup()
    const token = await sign(claims({ iss: 'https://example.com/other' }), signingKey)
    await expectUnauthorized(await call(token))
  })

  it("rejects another app client's token", async () => {
    const { signingKey, call } = await setup()
    await expectUnauthorized(await call(await sign(claims({ client_id: 'other' }), signingKey)))
  })

  it('rejects an ID token, which is not meant for APIs', async () => {
    const { signingKey, call } = await setup()
    const token = await sign(claims({ token_use: 'id', aud: config.clientId }), signingKey)
    await expectUnauthorized(await call(token))
  })

  it('rejects a token signed by a key the issuer does not publish', async () => {
    const { call } = await setup()
    const { signingKey: stranger } = await keyPair('key-1')
    await expectUnauthorized(await call(await sign(claims(), stranger)))
  })

  it('rejects a token whose signature was altered', async () => {
    const { signingKey, call } = await setup()
    const token = await sign(claims(), signingKey)
    const [header, , signature] = token.split('.')
    const forged = btoa(JSON.stringify(claims({ sub: 'user-b' }))).replace(/=+$/, '')
    await expectUnauthorized(await call(`${header ?? ''}.${forged}.${signature ?? ''}`))
  })
})

describe('createKeyCache', () => {
  const key = (kid: string) => ({ kid, kty: 'RSA' as const, alg: 'RS256', n: 'n', e: 'AQAB' })

  it('loads the keys once while they hold the key ID asked for', async () => {
    const load = vi.fn(() => Promise.resolve([key('a')]))
    const keysFor = createKeyCache(load)
    await keysFor('a')
    await keysFor('a')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('reloads for an unknown key ID, at most once per interval', async () => {
    let time = 0
    const load = vi.fn(() => Promise.resolve([key('a')]))
    const keysFor = createKeyCache(load, () => time)
    await keysFor('a')
    time = 60_000
    await keysFor('b')
    expect(load).toHaveBeenCalledTimes(1)
    time = 5 * 60_000
    await keysFor('b')
    expect(load).toHaveBeenCalledTimes(2)
  })
})
