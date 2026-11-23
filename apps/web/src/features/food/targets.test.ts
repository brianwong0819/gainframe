import { describe, expect, it } from 'vitest'

import {
  parseBirthYear,
  parseHeightCm,
  parseKcalTarget,
  parseProteinTarget,
  parseWeightKg,
} from './targets'

describe('typed daily targets', () => {
  it('reads protein with a point or a comma', () => {
    expect(parseProteinTarget('140')).toBe(140)
    expect(parseProteinTarget(' 142,5 ')).toBe(142.5)
  })

  it('reads energy as whole kcal', () => {
    expect(parseKcalTarget('2800')).toBe(2800)
    expect(parseKcalTarget('2800.5')).toBeNull()
  })

  it('rejects empty, zero, negative, oversized and non-numeric text', () => {
    for (const text of ['', ' ', '0', '-5', '1001', 'abc']) {
      expect(parseProteinTarget(text)).toBeNull()
    }
    for (const text of ['', '0', '-100', '20001', 'abc']) {
      expect(parseKcalTarget(text)).toBeNull()
    }
  })
})

describe('typed calculator answers', () => {
  it('reads a birth year, a height and a weight with a point or a comma', () => {
    expect(parseBirthYear('2001')).toBe(2001)
    expect(parseHeightCm('175,5')).toBe(175.5)
    expect(parseWeightKg(' 62.4 ')).toBe(62.4)
  })

  it('rejects what the profile and body metric schemas would', () => {
    expect(parseBirthYear('2001.5')).toBeNull()
    expect(parseBirthYear('1850')).toBeNull()
    expect(parseHeightCm('90')).toBeNull()
    expect(parseWeightKg('')).toBeNull()
    expect(parseWeightKg('500')).toBeNull()
  })
})
