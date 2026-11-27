import { describe, expect, it } from 'vitest'

import { parseBodyFat, parseBodyWeight, parseMuscleMass, stepTenth } from './weigh-in'

describe('weigh-in fields', () => {
  it('reads a typed weight, with a comma as the decimal point', () => {
    expect(parseBodyWeight('62.4')).toBe(62.4)
    expect(parseBodyWeight(' 62,4 ')).toBe(62.4)
    expect(parseBodyWeight('')).toBeNull()
    expect(parseBodyWeight('6')).toBeNull()
    expect(parseBodyWeight('abc')).toBeNull()
  })

  it('rejects body fat and muscle outside what a scan can report', () => {
    expect(parseBodyFat('14.5')).toBe(14.5)
    expect(parseBodyFat('90')).toBeNull()
    expect(parseMuscleMass('29.8')).toBe(29.8)
    expect(parseMuscleMass('0')).toBeNull()
  })

  it('steps on the 0.1 grid without float drift', () => {
    expect(stepTenth(62.3, 0.1, 1)).toBe(62.4)
    expect(stepTenth(0.3, 0.1, -1)).toBe(0.2)
  })
})
