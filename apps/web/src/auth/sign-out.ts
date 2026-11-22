// Sign-out (ADR-0007): revoke the refresh token at Cognito, then the caller
// clears the device and sends the page to managed login's /logout, which clears
// its own cookie and returns to Settings.
import type { AuthConfig } from './config'

const SIGNED_OUT_PATH = '/settings'

// Best effort: offline, or with Cognito unreachable, the token stays valid until
// it expires, but no copy of it remains on the device.
export async function revokeRefreshToken(config: AuthConfig, refreshToken: string): Promise<void> {
  try {
    await fetch(new URL('/oauth2/revoke', config.origin), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken, client_id: config.clientId }),
    })
  } catch {
    // Nothing to retry with: the session is deleted next.
  }
}

export function logoutUrl(config: AuthConfig, origin: string): string {
  const url = new URL('/logout', config.origin)
  url.search = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: `${origin}${SIGNED_OUT_PATH}`,
  }).toString()
  return url.toString()
}
