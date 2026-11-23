import { describe, expect, it } from 'vitest'

import { estimateTargets, type EstimateInput, restingEnergyKcal } from './target-estimate.ts'

const lifter: EstimateInput = {
  sex: 'male',
  birthYear: 2001,
  heightCm: 175,
  weightKg: 62,
  activityLevel: 'moderate',
  phase: 'bulk',
  year: 2026,
}

describe('restingEnergyKcal', () => {
  // Mifflin et al. 1990: 10 × kg + 6.25 × cm − 5 × years, +5 for men, −161 for women.
  it('follows Mifflin-St Jeor for men and women', () => {
    const body = { heightCm: 175, weightKg: 62, ageYears: 25 }
    expect(restingEnergyKcal({ ...body, sex: 'male' })).toBe(1593.75)
    expect(restingEnergyKcal({ ...body, sex: 'female' })).toBe(1427.75)
  })
})

describe('estimateTargets', () => {
  it('adds the bulk surplus to resting energy times the activity factor', () => {
    // 1,594 × 1.55 + 300 = 2,770.7, to the nearest 50 kcal; 62 kg × 2.0 g = 124 g, to the nearest 5 g.
    expect(estimateTargets(lifter)).toEqual({
      restingKcal: 1594,
      activityFactor: 1.55,
      phaseKcal: 300,
      kcal: 2750,
      proteinG: 125,
    })
  })

  it('takes energy down and protein up in a cut', () => {
    const cut = estimateTargets({ ...lifter, phase: 'cut' })
    expect(cut.kcal).toBe(2050)
    expect(cut.proteinG).toBe(135)
  })

  it('counts the age from the birth year', () => {
    const older = estimateTargets({ ...lifter, birthYear: 1986 })
    expect(older.restingKcal).toBe(1594 - 5 * 15)
  })
})
