// PKCE (RFC 7636) for the public web client: a random verifier kept on the
// device and its S256 challenge sent with the authorize request.

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)))
}

// BASE64URL(SHA-256(verifier)).
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}
