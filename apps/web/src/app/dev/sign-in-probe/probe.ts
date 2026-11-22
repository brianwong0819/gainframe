// Sign-in redirect check (M2-02 part b): bw runs it in the installed iPhone app
// to see where Cognito's redirect back lands and whether that page can read
// what the app stored before leaving. Findings choose the sign-in flow (ADR).

import { z } from 'zod'

import type { AuthConfig } from '@/auth/config'

export type ProbeMode = 'navigate' | 'popup'

// What the app stores before it leaves: the PKCE verifier and the state that
// the redirect must echo.
const pendingSchema = z.object({
  mode: z.enum(['navigate', 'popup']),
  state: z.string(),
  verifier: z.string(),
  startedAt: z.number(),
})
export type Pending = z.infer<typeof pendingSchema>

const pendingKey = 'gainframe.dev.sign-in-probe.pending'
const logKey = 'gainframe.dev.sign-in-probe.log'
const maxLogLines = 100

// Storage can be unavailable (private mode, blocked site data).
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Not persisted; the page still shows the result.
  }
}

export function loadPending(): Pending | null {
  const raw = read(pendingKey)
  if (raw === null) return null
  try {
    const result = pendingSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function savePending(pending: Pending | null): void {
  write(pendingKey, pending === null ? null : JSON.stringify(pending))
}

function loadLog(): string[] {
  const raw = read(logKey)
  if (raw === null) return []
  try {
    const result = z.array(z.string()).safeParse(JSON.parse(raw))
    return result.success ? result.data : []
  } catch {
    return []
  }
}

// The log as an external store for useSyncExternalStore, read from storage
// once, so lines written by another window before this one opened appear.
const noLines: readonly string[] = []
let lines: readonly string[] | null = null
const listeners = new Set<() => void>()

export function subscribeLog(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function logSnapshot(): readonly string[] {
  lines ??= loadLog()
  return lines
}

export function serverLogSnapshot(): readonly string[] {
  return noLines
}

function setLines(next: readonly string[]): void {
  lines = next
  write(logKey, next.length === 0 ? null : JSON.stringify(next))
  for (const listener of listeners) listener()
}

export function appendLog(line: string): void {
  const time = new Date().toISOString().slice(11, 19)
  setLines([...logSnapshot(), `${time} ${line}`].slice(-maxLogLines))
}

export function clearLog(): void {
  setLines(noLines)
}

export function authorizeUrl(
  config: AuthConfig,
  redirectUri: string,
  state: string,
  challenge: string,
): string {
  const url = new URL('/oauth2/authorize', config.origin)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: 'openid email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString()
  return url.toString()
}

const tokenResponseSchema = z.object({ id_token: z.string() })
const idClaimsSchema = z.object({ email: z.string() })

// Exchanges the code at the token endpoint and returns the signed-in email.
export async function exchangeCode(
  config: AuthConfig,
  redirectUri: string,
  code: string,
  verifier: string,
): Promise<string> {
  const response = await fetch(new URL('/oauth2/token', config.origin), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    }),
  })
  if (!response.ok) throw new Error(`token endpoint answered ${String(response.status)}`)
  const { id_token: idToken } = tokenResponseSchema.parse(await response.json())
  // Display only: the API verifies tokens (M2-03); the page just names the account.
  const payload = idToken.split('.')[1] ?? ''
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
  return idClaimsSchema.parse(JSON.parse(json)).email
}

// Where the page is running: the installed app, a Safari sheet or a tab.
export function describeContext(): string {
  const standalone = matchMedia('(display-mode: standalone)').matches
  const opener = window.opener !== null
  return `standalone ${standalone ? 'yes' : 'no'}, opener ${opener ? 'yes' : 'no'}`
}

export const channelName = 'gainframe.dev.sign-in-probe'
