import type { NutritionTotals } from './nutrition.ts'

export interface FoodCheck {
  loggedDays: number
  // The average energy of the logged days less the daily target.
  kcalVsTarget: number
  proteinMetDays: number
  // The average protein of the logged days; null when none was logged.
  averageProteinG: number | null
}

// Whether a day met the protein target; a day without a meal never does.
export function proteinMet(day: { proteinG: number; meals: number }, targetG: number): boolean {
  return day.meals > 0 && day.proteinG >= targetG
}

// How the food log compares with the daily targets over a span of days, for
// the weight page and the protein page. Only days with a meal logged count: a day without one says
// nothing about what was eaten, so it is neither a miss nor zero energy.
export function foodCheck(
  days: readonly (NutritionTotals & { meals: number })[],
  targets: { proteinG: number; kcal: number },
): FoodCheck {
  const logged = days.filter(({ meals }) => meals > 0)
  const met = logged.filter((each) => proteinMet(each, targets.proteinG))
  const averageKcal =
    logged.length === 0 ? 0 : logged.reduce((sum, { kcal }) => sum + kcal, 0) / logged.length
  return {
    loggedDays: logged.length,
    kcalVsTarget: logged.length === 0 ? 0 : averageKcal - targets.kcal,
    proteinMetDays: met.length,
    averageProteinG:
      logged.length === 0
        ? null
        : logged.reduce((sum, { proteinG }) => sum + proteinG, 0) / logged.length,
  }
}
