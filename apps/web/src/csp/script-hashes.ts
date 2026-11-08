import { createHash } from 'node:crypto'

// A static export carries the React Server Components payload and the Turbopack
// bootstrap as inline <script> elements, and no request exists to give them a
// nonce. Each page instead gets a <meta> policy that allows exactly its own
// inline scripts by hash. The response header from CloudFront still applies;
// the browser enforces both policies, so the stricter script-src wins.

const inlineScript = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g
const charsetMeta = /<meta charSet="utf-8"\/>/

/** `'sha256-…'` source expressions for every inline script in the page, in order. */
export function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(inlineScript)].map(
    ([, body = '']) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
  )
}

/**
 * Inserts the hash policy right after the charset declaration, so it precedes
 * every script; a <meta> policy does not cover elements parsed before it.
 */
export function addScriptHashPolicy(html: string): string {
  if (html.includes('http-equiv="Content-Security-Policy"')) {
    throw new Error('The page already has a <meta> Content-Security-Policy')
  }
  const charset = charsetMeta.exec(html)
  if (!charset) throw new Error('No <meta charSet="utf-8"/> to insert the policy after')
  const end = charset.index + charset[0].length
  if (html.slice(0, end).includes('<script')) {
    throw new Error('A script precedes the charset declaration')
  }
  const sources = ["'self'", ...inlineScriptHashes(html)].join(' ')
  const meta = `<meta http-equiv="Content-Security-Policy" content="script-src ${sources}"/>`
  return html.slice(0, end) + meta + html.slice(end)
}
