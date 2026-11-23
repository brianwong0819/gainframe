import { domainConfig } from '../config.ts'
import type { ActivityLevel, Phase, Sex } from '../schemas/profile.ts'

export interface EstimateInput {
  sex: Sex
  birthYear: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  phase: Phase
  // The calendar year on the user's device; the age is this less the birth year.
  year: number
}

export interface TargetEstimate {
  restingKcal: number
  activityFactor: number
  phaseKcal: number
  kcal: number
  proteinG: number
}

const { activityFactors, phaseKcal, proteinGPerKg } = domainConfig.estimate
const { kcalStep, proteinStepG } = domainConfig.targets

const roundTo = (value: number, step: number) => Math.round(value / step) * step

// Resting energy by Mifflin-St Jeor, in kcal a day.
export function restingEnergyKcal(
  input: Pick<EstimateInput, 'sex' | 'heightCm' | 'weightKg'> & { ageYears: number },
): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears
  return base + (input.sex === 'male' ? 5 : -161)
}

// Daily targets from the calculator's answers: resting energy times the
// activity factor plus the phase's change, and protein per kg of body weight.
// Both are rounded to the targets sheet's steps, so a tap on a stepper moves
// from the estimate by exactly one step. The parts are returned so the sheet
// can show how the energy figure was reached.
export function estimateTargets(input: EstimateInput): TargetEstimate {
  const restingKcal = Math.round(
    restingEnergyKcal({ ...input, ageYears: input.year - input.birthYear }),
  )
  const activityFactor = activityFactors[input.activityLevel]
  const change = phaseKcal[input.phase]
  return {
    restingKcal,
    activityFactor,
    phaseKcal: change,
    kcal: roundTo(restingKcal * activityFactor + change, kcalStep),
    proteinG: roundTo(input.weightKg * proteinGPerKg[input.phase], proteinStepG),
  }
}
