import { describe, expect, it } from 'vitest'

import { authorizeUrl, codeChallenge } from './probe'

describe('sign-in probe', () => {
  it('derives the S256 challenge of RFC 7636 appendix B', async () => {
    await expect(codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).resolves.toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('asks for an authorization code with PKCE', () => {
    const url = new URL(
      authorizeUrl(
        { origin: 'https://example.auth.ap-southeast-1.amazoncognito.com', clientId: 'client' },
        'https://app.example/dev/sign-in-probe',
        'state',
        'challenge',
      ),
    )
    expect(url.pathname).toBe('/oauth2/authorize')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client',
      redirect_uri: 'https://app.example/dev/sign-in-probe',
      scope: 'openid email',
      state: 'state',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
    })
  })
})
