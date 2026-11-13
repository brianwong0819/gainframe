import { describe, expect, it } from 'vitest'

import { displayWeight, fromKg, stepToGrid, toKg } from './weight-unit.ts'

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

describe('displayWeight', () => {
  it('shows kg on the 0.25 kg grid as stored and other kg to 0.1 kg', () => {
    expect(displayWeight(62.5, 'kg')).toBe(62.5)
    expect(displayWeight(1.25, 'kg')).toBe(1.25)
    expect(displayWeight(60.75, 'kg')).toBe(60.75)
    expect(displayWeight(toKg(10, 'lb'), 'kg')).toBe(4.5)
    expect(displayWeight(toKg(50, 'lb'), 'kg')).toBe(22.7)
  })

  it('shows pounds to 0.1 lb', () => {
    expect(displayWeight(toKg(45, 'lb'), 'lb')).toBe(45)
    expect(displayWeight(60, 'lb')).toBe(132.3)
  })
})

describe('stepToGrid', () => {
  it('moves a weight on the grid by one step', () => {
    expect(stepToGrid(60, 2.5, 1)).toBe(62.5)
    expect(stepToGrid(60, 2.5, -1)).toBe(57.5)
    expect(stepToGrid(45, 5, 1)).toBe(50)
  })

  it('moves an off-grid weight to the next multiple of the step', () => {
    expect(stepToGrid(4.54, 2.5, 1)).toBe(5)
    expect(stepToGrid(4.54, 2.5, -1)).toBe(2.5)
    expect(stepToGrid(132.3, 5, 1)).toBe(135)
    expect(stepToGrid(132.3, 5, -1)).toBe(130)
  })

  it('never goes below 0', () => {
    expect(stepToGrid(1, 2.5, -1)).toBe(0)
    expect(stepToGrid(0, 2.5, -1)).toBe(0)
  })
})
