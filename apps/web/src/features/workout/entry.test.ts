import { describe, expect, it } from 'vitest'

import { parseReps, parseWeight } from './entry'

describe('parseWeight', () => {
  it('reads decimals with a point or a comma', () => {
    expect(parseWeight('62.5', 'kg')).toBe(62.5)
    expect(parseWeight(' 62,5 ', 'kg')).toBe(62.5)
    expect(parseWeight('0', 'kg')).toBe(0)
  })

  it('returns a weight typed in pounds in kg', () => {
    expect(parseWeight('45', 'lb')).toBe(20.41)
    expect(parseWeight('2204', 'lb')).toBe(999.72)
  })

  it('rejects empty, negative, oversized and non-numeric text', () => {
    for (const text of ['', ' ', '-5', '1001', 'abc', '6.2.5']) {
      expect(parseWeight(text, 'kg')).toBeNull()
    }
    expect(parseWeight('2205', 'lb')).toBeNull()
  })
})

describe('parseReps', () => {
  it('reads whole numbers only', () => {
    expect(parseReps('8')).toBe(8)
    expect(parseReps('7.5')).toBeNull()
    expect(parseReps('')).toBeNull()
    expect(parseReps('-1')).toBeNull()
  })
})
