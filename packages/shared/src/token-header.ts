// How the web app sends its Cognito access token to the API (ADR-0002). It
// travels in its own header because CloudFront replaces `Authorization` when it
// signs the request to the function URL. Both apps use these, so the client's
// format and the server's parser cannot drift apart (L-042).
export const TOKEN_HEADER = 'x-gainframe-token'

export function tokenHeaderValue(token: string): string {
  return `Bearer ${token}`
}

// The token in a header value, or null when the value is missing or malformed.
export function tokenFromHeader(value: string | undefined): string | null {
  const match = /^Bearer (\S+)$/.exec(value ?? '')
  return match?.[1] ?? null
}
