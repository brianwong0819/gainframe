import { describe, expect, it } from 'vitest'

import { userPoolIdOf } from './identity.ts'

describe('userPoolIdOf', () => {
  it('reads the pool ID from the issuer', () => {
    expect(
      userPoolIdOf('https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_Abc123'),
    ).toBe('ap-southeast-1_Abc123')
  })

  it('refuses an issuer without a pool', () => {
    expect(() => userPoolIdOf('https://cognito-idp.ap-southeast-1.amazonaws.com/')).toThrow()
  })
})
