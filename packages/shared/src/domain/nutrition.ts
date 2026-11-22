import type { MealItem } from '../schemas/food.ts'

export interface NutritionTotals {
  proteinG: number
  kcal: number
}

// The protein and energy of a meal or a day: the sum of its live items.
// Deleted items count for nothing. Figures are summed unrounded; the screens
// round when they show them, so a day of small items does not drift.
export function nutritionTotals(
  items: readonly Pick<MealItem, 'proteinG' | 'kcal' | 'deletedAt'>[],
): NutritionTotals {
  let proteinG = 0
  let kcal = 0
  for (const item of items) {
    if (item.deletedAt !== null) continue
    proteinG += item.proteinG
    kcal += item.kcal
  }
  return { proteinG, kcal }
}
