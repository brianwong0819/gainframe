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

// An item's figures for a new portion size: protein and energy scale with the
// grams, since both are per portion of the same food.
export function scalePortion(
  item: Pick<MealItem, 'grams' | 'proteinG' | 'kcal'>,
  grams: number,
): Pick<MealItem, 'grams' | 'proteinG' | 'kcal'> {
  const ratio = grams / item.grams
  return { grams, proteinG: item.proteinG * ratio, kcal: item.kcal * ratio }
}

// Up to `max` of the user's frequent foods that fill a protein gap with the
// fewest items (Today's card, option C; no model is involved). One food when
// one covers the gap, the one that overshoots least; else two different foods,
// the pair that covers it with the least overshoot, or the pair closest to it
// when none does. Nothing when the gap is closed or there are no foods.
export function fillProteinGap(gapG: number, foods: readonly PastFood[], max = 2): PastFood[] {
  const usable = foods.filter((food) => food.proteinG > 0)
  if (gapG <= 0 || usable.length === 0 || max < 1) return []
  const byOvershoot = (protein: number) => (protein >= gapG ? protein - gapG : Infinity)
  const single = usable.toSorted((a, b) => byOvershoot(a.proteinG) - byOvershoot(b.proteinG))[0]
  if (single !== undefined && single.proteinG >= gapG) return [single]
  if (max < 2 || usable.length < 2) {
    return usable.toSorted((a, b) => b.proteinG - a.proteinG).slice(0, 1)
  }
  const pairs = usable.flatMap((a, i) => usable.slice(i + 1).map((b) => [a, b] as const))
  const sum = ([a, b]: readonly [PastFood, PastFood]) => a.proteinG + b.proteinG
  const covering = pairs.filter((pair) => sum(pair) >= gapG)
  const best =
    covering.length > 0
      ? covering.toSorted((x, y) => sum(x) - sum(y))[0]
      : pairs.toSorted((x, y) => sum(y) - sum(x))[0]
  return best === undefined ? [] : [...best]
}
