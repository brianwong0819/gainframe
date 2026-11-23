import { describe, expect, it } from 'vitest'

import { tokenAllowsAi } from './groups'

const token = (payload: unknown) =>
  ['header', btoa(JSON.stringify(payload)).replace(/=+$/, ''), 'signature'].join('.')

describe('tokenAllowsAi', () => {
  it('allows a token whose groups include ai', () => {
    expect(tokenAllowsAi(token({ sub: 'a', 'cognito:groups': ['ai'] }))).toBe(true)
  })

  it('refuses a token without the group', () => {
    expect(tokenAllowsAi(token({ sub: 'a', 'cognito:groups': ['other'] }))).toBe(false)
    expect(tokenAllowsAi(token({ sub: 'a' }))).toBe(false)
  })

  it('reads base64url payloads', () => {
    // '?' encodes to a '/' in base64, '_' in base64url.
    const raw = btoa(JSON.stringify({ n: '???', 'cognito:groups': ['ai'] }))
    const url = raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(url).toContain('_')
    expect(tokenAllowsAi(`h.${url}.s`)).toBe(true)
  })

  it('refuses a malformed token', () => {
    expect(tokenAllowsAi('not-a-token')).toBe(false)
    expect(tokenAllowsAi('a.!!!.c')).toBe(false)
  })
})
