import type { NutritionTotals } from './nutrition.ts'

export interface FoodCheck {
  loggedDays: number
  // The average energy of the logged days less the daily target.
  kcalVsTarget: number
  proteinMetDays: number
}

// How the food log compares with the daily targets over a span of days, for
// the weight page. Only days with a meal logged count: a day without one says
// nothing about what was eaten, so it is neither a miss nor zero energy.
export function foodCheck(
  days: readonly (NutritionTotals & { meals: number })[],
  targets: { proteinG: number; kcal: number },
): FoodCheck {
  const logged = days.filter(({ meals }) => meals > 0)
  const averageKcal =
    logged.length === 0 ? 0 : logged.reduce((sum, { kcal }) => sum + kcal, 0) / logged.length
  return {
    loggedDays: logged.length,
    kcalVsTarget: logged.length === 0 ? 0 : averageKcal - targets.kcal,
    proteinMetDays: logged.filter(({ proteinG }) => proteinG >= targets.proteinG).length,
  }
}
