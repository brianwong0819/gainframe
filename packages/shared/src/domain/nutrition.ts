import { domainConfig } from '../config.ts'
import type { MealItem, MealType } from '../schemas/food.ts'
import { type LocalDate, localDateSchema } from '../schemas/row.ts'

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

// The meal type for a meal logged at `hour` (0 to 23) on the device's clock.
export function mealTypeAt(hour: number): MealType {
  const { breakfast, lunch, snack, dinner, supper } = domainConfig.mealHours
  if (hour < breakfast || hour >= supper) return 'snack'
  if (hour < lunch) return 'breakfast'
  if (hour < snack) return 'lunch'
  if (hour < dinner) return 'snack'
  return 'dinner'
}

// A food the user has eaten before, as one portion: the figures of its latest
// use, how often it was eaten and when last.
export interface PastFood {
  name: string
  grams: number
  proteinG: number
  kcal: number
  count: number
  lastAt: string
}

const foodKey = (name: string) => name.trim().toLocaleLowerCase()

// The user's foods, derived from past meal items (there is no food table of
// their own): one entry per name, ignoring case, with the portion and figures
// of its latest use. Deleted items are skipped. `frequent` orders by how often
// a food was eaten, then by how recently; `recent` by how recently.
export function pastFoods(
  items: readonly Pick<
    MealItem,
    'name' | 'grams' | 'proteinG' | 'kcal' | 'createdAt' | 'deletedAt'
  >[],
  order: 'frequent' | 'recent',
): PastFood[] {
  const foods = new Map<string, PastFood>()
  for (const item of items) {
    if (item.deletedAt !== null) continue
    const key = foodKey(item.name)
    const known = foods.get(key)
    const latest = known === undefined || item.createdAt > known.lastAt
    foods.set(key, {
      ...(latest
        ? { name: item.name, grams: item.grams, proteinG: item.proteinG, kcal: item.kcal }
        : known),
      count: (known?.count ?? 0) + 1,
      lastAt: latest ? item.createdAt : known.lastAt,
    })
  }
  const byRecent = (a: PastFood, b: PastFood) => b.lastAt.localeCompare(a.lastAt)
  return [...foods.values()].sort(
    order === 'recent' ? byRecent : (a, b) => b.count - a.count || byRecent(a, b),
  )
}

// The calendar day `days` after `date` (before, when negative). Arithmetic on
// a date that is already local, in UTC, so no time zone can move it.
export function addDays(date: LocalDate, days: number): LocalDate {
  const noon = Date.parse(`${date}T12:00:00.000Z`) + days * 24 * 60 * 60 * 1000
  return localDateSchema.parse(new Date(noon).toISOString().slice(0, 10))
}
