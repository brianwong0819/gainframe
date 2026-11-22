// Token refresh (ADR-0007): the access token lasts 60 minutes and is renewed
// with the refresh token shortly before it expires. Cognito answers a revoked or
// expired refresh token with `invalid_grant`, which ends the session as expired
// (token endpoint: https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html).
import { z } from 'zod'

import type { AuthConfig } from './config'
import type { AuthSession } from './session'

// An access token this close to its expiry is renewed before use, so it cannot
// expire on the way to the API.
export const REFRESH_LEAD_MS = 60 * 1000

// Cognito returns a new refresh token only when rotation is enabled; otherwise
// the current one stays valid.
const refreshResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token: z.string().min(1).optional(),
})
const errorResponseSchema = z.object({ error: z.string() })

// The refresh token is no longer accepted: the user must sign in again.
export class SessionExpiredError extends Error {
  constructor() {
    super('session expired')
    this.name = 'SessionExpiredError'
  }
}

export function needsRefresh(session: AuthSession, now: Date): boolean {
  return Date.parse(session.accessExpiresAt) - now.getTime() <= REFRESH_LEAD_MS
}

// Returns the session with a new access token. Throws SessionExpiredError when
// Cognito refuses the refresh token, and any other error (offline, a server
// error) when the refresh can be tried again later.
export async function refreshSession(
  config: AuthConfig,
  session: AuthSession,
  now: Date = new Date(),
): Promise<AuthSession> {
  const response = await fetch(new URL('/oauth2/token', config.origin), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      refresh_token: session.refreshToken,
    }),
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = errorResponseSchema.safeParse(body)
    if (error.success && error.data.error === 'invalid_grant') throw new SessionExpiredError()
    throw new Error(`token endpoint answered ${String(response.status)}`)
  }
  const tokens = refreshResponseSchema.parse(body)
  return {
    ...session,
    accessToken: tokens.access_token,
    accessExpiresAt: new Date(now.getTime() + tokens.expires_in * 1000).toISOString(),
    refreshToken: tokens.refresh_token ?? session.refreshToken,
  }
}
