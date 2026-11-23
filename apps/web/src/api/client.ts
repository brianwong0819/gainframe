// The one way the web app calls the API (ADR-0002). It adds the Cognito access
// token in `x-gainframe-token` (CloudFront replaces `Authorization`) and, for
// POST and PUT, the SHA-256 of the body in `x-amz-content-sha256`, which the
// function URL's origin access control requires. A request the server answers
// with an error status is recorded for Diagnostics with its request ID.
import { apiErrorSchema, TOKEN_HEADER, tokenHeaderValue } from '@gainframe/shared'
import type { z } from 'zod'

import type { AuthConfig } from '../auth/config'
import { needsRefresh, refreshSession, SessionExpiredError } from '../auth/refresh'
import type { AuthSession } from '../auth/session'
import { loadSession, saveSession } from '../db/auth-session'
import type { GainframeDb } from '../db/schema'

// No session on this device, or one that has expired: nothing can be sent until
// the user signs in (again).
export class NotSignedInError extends Error {
  constructor(readonly expired: boolean) {
    super(expired ? 'session expired' : 'not signed in')
    this.name = 'NotSignedInError'
  }
}

// The server answered with an error status. `code` is null when the body is not
// the shared error shape (for example a CloudFront error page).
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: z.infer<typeof apiErrorSchema>['error']['code'] | null,
    readonly requestId: string | null,
  ) {
    super(`API answered ${String(status)}`)
    this.name = 'ApiRequestError'
  }
}

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  // The path under the site's origin, e.g. `/api/sync/pull?cursor=0`.
  path: string
  body?: unknown
  headers?: Record<string, string>
}

interface ApiClientOptions {
  db: GainframeDb
  config: AuthConfig
  // Called once for each request answered with an error status.
  onFailure: (message: string) => void
  now?: () => Date
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createApiClient({
  db,
  config,
  onFailure,
  now = () => new Date(),
}: ApiClientOptions) {
  // One refresh at a time: requests that need a new token wait for the same one.
  let refreshing: Promise<AuthSession> | null = null

  async function renew(session: AuthSession): Promise<AuthSession> {
    refreshing ??= refreshSession(config, session, now())
      .then(async (renewed) => {
        // Saved only if the stored session is still this one: a sign-out or a
        // new sign-in during the refresh wins.
        await db.transaction('rw', db.settings, async () => {
          const stored = await loadSession(db)
          if (stored?.refreshToken === session.refreshToken) await saveSession(db, renewed)
        })
        return renewed
      })
      .catch(async (error: unknown) => {
        if (error instanceof SessionExpiredError) {
          await db.transaction('rw', db.settings, async () => {
            const stored = await loadSession(db)
            if (stored?.refreshToken === session.refreshToken) {
              await saveSession(db, { ...stored, expired: true })
            }
          })
          throw new NotSignedInError(true)
        }
        throw error
      })
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  async function currentSession(): Promise<AuthSession> {
    const session = await loadSession(db)
    if (session === null || session.expired) throw new NotSignedInError(session?.expired ?? false)
    return needsRefresh(session, now()) ? renew(session) : session
  }

  async function send(request: ApiRequest, session: AuthSession): Promise<Response> {
    const body = request.body === undefined ? undefined : JSON.stringify(request.body)
    const headers = new Headers(request.headers)
    headers.set(TOKEN_HEADER, tokenHeaderValue(session.accessToken))
    if (body !== undefined) {
      headers.set('content-type', 'application/json')
      headers.set('x-amz-content-sha256', await sha256Hex(body))
    }
    return fetch(request.path, { method: request.method, headers, body: body ?? null })
  }

  // Sends the request and returns its body parsed by `schema`. Throws
  // NotSignedInError, ApiRequestError, or the fetch error when offline.
  async function request<T>(schema: z.ZodType<T>, apiRequest: ApiRequest): Promise<T> {
    const session = await currentSession()
    let response = await send(apiRequest, session)
    // The API refused the token although it looked valid here (a device clock
    // that runs slow): renew it once and try again.
    if (response.status === 401) response = await send(apiRequest, await renew(session))
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null))
      const requestId = response.headers.get('x-request-id')
      const route = apiRequest.path.split('?')[0] ?? apiRequest.path
      onFailure(
        `${apiRequest.method} ${route} answered ${String(response.status)} (request ${requestId ?? 'unknown'})`,
      )
      throw new ApiRequestError(
        response.status,
        parsed.success ? parsed.data.error.code : null,
        requestId,
      )
    }
    // 204 No Content (DELETE /api/account) has no body to parse.
    return schema.parse(response.status === 204 ? undefined : await response.json())
  }

  return { request }
}

export type ApiClient = ReturnType<typeof createApiClient>
