import { describe, expect, it } from 'vitest'

import { parseReps, parseWeightKg } from './entry'

describe('parseWeightKg', () => {
  it('reads decimals with a point or a comma', () => {
    expect(parseWeightKg('62.5')).toBe(62.5)
    expect(parseWeightKg(' 62,5 ')).toBe(62.5)
    expect(parseWeightKg('0')).toBe(0)
  })

  it('rejects empty, negative, oversized and non-numeric text', () => {
    for (const text of ['', ' ', '-5', '1001', 'abc', '6.2.5']) {
      expect(parseWeightKg(text)).toBeNull()
    }
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
