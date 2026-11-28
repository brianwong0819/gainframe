import { describe, expect, it } from 'vitest'

import { foodCheck, proteinMet } from './food-check.ts'

const targets = { proteinG: 140, kcal: 2800 }
const day = (proteinG: number, kcal: number, meals = 3) => ({ proteinG, kcal, meals })

describe('foodCheck', () => {
  it('averages the energy of logged days against the target and counts protein days', () => {
    const check = foodCheck([day(150, 2700), day(120, 2600), day(140, 2900)], targets)
    expect(check).toMatchObject({ loggedDays: 3, proteinMetDays: 2 })
    expect(check.averageProteinG).toBeCloseTo(136.7, 1)
    expect(check.kcalVsTarget).toBeCloseTo(-66.7, 1)
  })

  it('leaves out days without a meal', () => {
    expect(foodCheck([day(0, 0, 0), day(160, 3000)], targets)).toEqual({
      loggedDays: 1,
      kcalVsTarget: 200,
      proteinMetDays: 1,
      averageProteinG: 160,
    })
  })

  it('reports nothing logged as no days', () => {
    expect(foodCheck([day(0, 0, 0)], targets)).toEqual({
      loggedDays: 0,
      kcalVsTarget: 0,
      proteinMetDays: 0,
      averageProteinG: null,
    })
  })
})

describe('proteinMet', () => {
  it('needs a logged day at or above the target', () => {
    expect(proteinMet(day(140, 2000), 140)).toBe(true)
    expect(proteinMet(day(139.9, 2000), 140)).toBe(false)
    expect(proteinMet(day(0, 0, 0), 0.1)).toBe(false)
  })
})
