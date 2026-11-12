import { describe, expect, it } from 'vitest'

import { fromKg, toKg } from './weight-unit.ts'

describe('toKg', () => {
  it('keeps kg and converts pounds, to the nearest 10 g', () => {
    expect(toKg(62.5, 'kg')).toBe(62.5)
    expect(toKg(0.1 + 0.2, 'kg')).toBe(0.3)
    expect(toKg(45, 'lb')).toBe(20.41)
    expect(toKg(100, 'lb')).toBe(45.36)
    expect(toKg(0, 'lb')).toBe(0)
  })
})

describe('fromKg', () => {
  it('shows kg to 10 g and pounds to 0.1 lb', () => {
    expect(fromKg(62.5, 'kg')).toBe(62.5)
    expect(fromKg(20, 'lb')).toBe(44.1)
    expect(fromKg(100, 'lb')).toBe(220.5)
  })

  it('reads every weight typed in pounds back as typed', () => {
    // 0 to 2200 lb (the stored maximum is 1000 kg) in steps of 0.1 lb.
    for (let tenths = 0; tenths <= 22_000; tenths += 1) {
      const lb = tenths / 10
      expect(fromKg(toKg(lb, 'lb'), 'lb')).toBe(lb)
    }
  })
})
