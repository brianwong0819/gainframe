import { describe, expect, it } from 'vitest'

import { codeChallenge, randomToken } from './pkce'

describe('PKCE', () => {
  it('derives the S256 challenge of RFC 7636 appendix B', async () => {
    await expect(codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).resolves.toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('makes a 43-character verifier, the length of 32 random bytes in base64url', () => {
    expect(randomToken()).toMatch(/^[\w-]{43}$/)
  })
})
