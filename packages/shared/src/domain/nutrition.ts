import { domainConfig } from '../config.ts'
import type { MealItem, MealType } from '../schemas/food.ts'
import type { FoodEstimateItem } from '../schemas/food-estimate.ts'
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

// The foods eaten often enough to be habits (the Food tab's frequent row): on
// at least `minDays` different local days within the last `windowDays` days
// ending `today`. Ordered by the days eaten, then by how recently; each food
// has the portion and figures of its latest use in the window. Days come from
// the meal's `localDate`, never from a timestamp.
export function habitualFoods(
  items: readonly (Pick<
    MealItem,
    'name' | 'grams' | 'proteinG' | 'kcal' | 'createdAt' | 'deletedAt'
  > & { localDate: LocalDate })[],
  today: LocalDate,
): PastFood[] {
  const { minDays, windowDays } = domainConfig.habitFoods
  const from = addDays(today, 1 - windowDays)
  const inWindow = items.filter((item) => item.localDate >= from && item.localDate <= today)
  const days = new Map<string, Set<LocalDate>>()
  for (const item of inWindow) {
    if (item.deletedAt !== null) continue
    const key = foodKey(item.name)
    days.set(key, (days.get(key) ?? new Set()).add(item.localDate))
  }
  const daysOf = (food: PastFood) => days.get(foodKey(food.name))?.size ?? 0
  return pastFoods(inWindow, 'frequent')
    .filter((food) => daysOf(food) >= minDays)
    .sort((a, b) => daysOf(b) - daysOf(a) || b.lastAt.localeCompare(a.lastAt))
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

type Figures = Pick<FoodEstimateItem, 'grams' | 'proteinG' | 'kcal' | 'nutrients'>

// The figures for a portion of `grams` of a food the model estimated again
// from its name (an estimated item renamed on the confirm screen): the
// estimate's items are summed and scaled to the portion, since the portion
// came from the photo. `model` when any item had no table entry. Null when
// the estimate had no items.
export function reestimatedFigures(grams: number, estimate: readonly Figures[]): Figures | null {
  const sum = estimate.reduce(
    (total, item) => ({
      grams: total.grams + item.grams,
      proteinG: total.proteinG + item.proteinG,
      kcal: total.kcal + item.kcal,
    }),
    { grams: 0, proteinG: 0, kcal: 0 },
  )
  if (sum.grams <= 0) return null
  return {
    ...scalePortion(sum, grams),
    nutrients: estimate.some((item) => item.nutrients === 'model') ? 'model' : 'table',
  }
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
