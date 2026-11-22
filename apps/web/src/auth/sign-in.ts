// Sign-in by full-page redirect with PKCE (ADR-0007): the page saves the state
// and verifier, leaves for Cognito, and the redirect back to SIGN_IN_PATH
// exchanges the code for tokens.
import { z } from 'zod'

import type { AuthConfig } from './config'
import { codeChallenge, randomToken } from './pkce'
import type { AuthSession } from './session'

const SIGN_IN_PATH = '/settings/sign-in'

// A sign-in left unfinished longer than this is stale; its code would have
// expired at Cognito too.
const PENDING_MAX_AGE_MS = 10 * 60 * 1000
const pendingKey = 'gainframe.sign-in.pending'

const pendingSchema = z.object({ state: z.string(), verifier: z.string(), startedAt: z.number() })

// Storage can be unavailable (private mode, blocked site data); sign-in then
// fails at the redirect back with `no_pending`.
function writePending(value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(pendingKey)
    else localStorage.setItem(pendingKey, value)
  } catch {
    // Reported as no_pending when the redirect returns.
  }
}

function takePending(now: number) {
  let raw: string | null
  try {
    raw = localStorage.getItem(pendingKey)
  } catch {
    return null
  }
  writePending(null)
  if (raw === null) return null
  try {
    const result = pendingSchema.safeParse(JSON.parse(raw))
    return result.success && now - result.data.startedAt <= PENDING_MAX_AGE_MS ? result.data : null
  } catch {
    return null
  }
}

function redirectUri(): string {
  return `${window.location.origin}${SIGN_IN_PATH}`
}

function authorizeUrl(config: AuthConfig, state: string, challenge: string): string {
  const url = new URL('/oauth2/authorize', config.origin)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri(),
    scope: 'openid email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString()
  return url.toString()
}

export async function startSignIn(config: AuthConfig): Promise<void> {
  const state = randomToken()
  const verifier = randomToken()
  writePending(JSON.stringify({ state, verifier, startedAt: Date.now() }))
  window.location.assign(authorizeUrl(config, state, await codeChallenge(verifier)))
}

// Why a redirect back did not sign in. `denied`: Cognito or the user ended the
// sign-in. `no_pending`: no matching sign-in was started on this device, or it
// is stale. `exchange`: the token endpoint refused or could not be reached.
export type SignInFailure = 'denied' | 'no_pending' | 'exchange'

export class SignInError extends Error {
  constructor(readonly failure: SignInFailure) {
    super(`sign-in failed: ${failure}`)
    this.name = 'SignInError'
  }
}

const tokenResponseSchema = z.object({
  access_token: z.string(),
  id_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().positive(),
})
const idClaimsSchema = z.object({ sub: z.string().min(1), email: z.string().min(1) })

// Display only: the ID token came straight from the token endpoint over TLS,
// and the API verifies the access token on every request (M2-03).
function idClaims(idToken: string) {
  const payload = (idToken.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')
  return idClaimsSchema.parse(JSON.parse(atob(payload)))
}

// True when the page was opened by Cognito's redirect back.
export function isSignInRedirect(params: URLSearchParams): boolean {
  return params.has('code') || params.has('error')
}

export async function finishSignIn(
  config: AuthConfig,
  params: URLSearchParams,
  now: Date = new Date(),
): Promise<AuthSession> {
  const pending = takePending(now.getTime())
  const code = params.get('code')
  if (params.has('error') || code === null) throw new SignInError('denied')
  if (pending?.state !== params.get('state')) {
    throw new SignInError('no_pending')
  }
  let tokens: z.infer<typeof tokenResponseSchema>
  try {
    const response = await fetch(new URL('/oauth2/token', config.origin), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        redirect_uri: redirectUri(),
        code,
        code_verifier: pending.verifier,
      }),
    })
    if (!response.ok) throw new Error(`token endpoint answered ${String(response.status)}`)
    tokens = tokenResponseSchema.parse(await response.json())
  } catch {
    throw new SignInError('exchange')
  }
  const { sub, email } = idClaims(tokens.id_token)
  return {
    userId: sub,
    email,
    accessToken: tokens.access_token,
    accessExpiresAt: new Date(now.getTime() + tokens.expires_in * 1000).toISOString(),
    refreshToken: tokens.refresh_token,
    expired: false,
  }
}
