import { TOKEN_HEADER, tokenFromHeader } from '@gainframe/shared'
import { decode, verifyWithJwks } from 'hono/jwt'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import type { AppEnv } from './context.ts'
import { errorBody } from './error-body.ts'

export interface AuthConfig {
  // https://cognito-idp.<region>.amazonaws.com/<user pool ID>
  issuer: string
  // The web app's client; Cognito access tokens carry it as `client_id`, not `aud`.
  clientId: string
}

const jwksSchema = z.object({
  keys: z.array(
    z.object({
      kid: z.string(),
      kty: z.literal('RSA'),
      alg: z.string(),
      n: z.string(),
      e: z.string(),
    }),
  ),
})
export type Jwks = z.infer<typeof jwksSchema>['keys']

// Cognito rotates its signing keys rarely; a token signed with a key this
// instance has not seen refetches the set, at most once per interval.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000
const JWKS_TIMEOUT_MS = 3000

export function fetchJwks(issuer: string): () => Promise<Jwks> {
  return async () => {
    const response = await fetch(`${issuer}/.well-known/jwks.json`, {
      signal: AbortSignal.timeout(JWKS_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`JWKS request failed with ${String(response.status)}`)
    return jwksSchema.parse(await response.json()).keys
  }
}

/** Caches the issuer's signing keys and refetches them for an unknown key ID. */
export function createKeyCache(load: () => Promise<Jwks>, now: () => number = Date.now) {
  let keys: Jwks | null = null
  let loadedAt = 0
  return async (kid: string): Promise<Jwks> => {
    const stale = now() - loadedAt >= REFRESH_INTERVAL_MS
    if (keys === null || (stale && !keys.some((key) => key.kid === kid))) {
      keys = await load()
      loadedAt = now()
    }
    return keys
  }
}

function claimsSchema(clientId: string) {
  return z.object({
    sub: z.string().min(1),
    token_use: z.literal('access'),
    client_id: z.literal(clientId),
  })
}

/**
 * Accepts only a valid Cognito access token for the web app and sets
 * `userId` to its `sub`. Every other request gets 401; the token is never logged.
 */
export function requireUser(
  config: AuthConfig,
  keysFor: (kid: string) => Promise<Jwks>,
): MiddlewareHandler<AppEnv> {
  const claims = claimsSchema(config.clientId)
  return async (c, next) => {
    const token = tokenFromHeader(c.req.header(TOKEN_HEADER))
    const userId = token === null ? null : await verifiedUserId(token)
    if (userId === null) {
      return c.json(errorBody('unauthorized', 'Sign-in required', c.var.requestId), 401)
    }
    c.set('userId', userId)
    return next()
  }

  async function verifiedUserId(token: string): Promise<string | null> {
    let kid: string | undefined
    try {
      kid = decode(token).header.kid
    } catch {
      return null
    }
    if (kid === undefined) return null
    // A failure to fetch the keys is the server's problem, so it is thrown (500).
    const keys = await keysFor(kid)
    try {
      const payload = await verifyWithJwks(token, {
        keys,
        verification: { iss: config.issuer },
        allowedAlgorithms: ['RS256'],
      })
      const result = claims.safeParse(payload)
      return result.success ? result.data.sub : null
    } catch {
      return null
    }
  }
}
