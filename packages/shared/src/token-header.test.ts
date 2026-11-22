import { describe, expect, it } from 'vitest'

import { tokenFromHeader, tokenHeaderValue } from './token-header.ts'

describe('token header', () => {
  it('reads back the token it formats', () => {
    expect(tokenFromHeader(tokenHeaderValue('eyJ.a.b'))).toBe('eyJ.a.b')
  })

  it('refuses a bare token, an empty value and extra words', () => {
    expect(tokenFromHeader('eyJ.a.b')).toBeNull()
    expect(tokenFromHeader(undefined)).toBeNull()
    expect(tokenFromHeader('Bearer ')).toBeNull()
    expect(tokenFromHeader('Bearer a b')).toBeNull()
  })
})
