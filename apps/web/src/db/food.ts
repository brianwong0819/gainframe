import {
  currentFoods,
  type Food,
  type LocalDate,
  type Meal,
  type MealItem,
  type MealType,
  nutritionTotals,
  type NutritionTotals,
  pastFoods,
  type PastFood,
  toLocalDate,
  withLibraryPortions,
} from '@gainframe/shared'

import type { NewRow, Repositories } from './repositories'
import type { GainframeDb } from './schema'

export interface MealWithItems {
  meal: Meal
  items: MealItem[]
  totals: NutritionTotals
}

export interface FoodDay {
  meals: MealWithItems[]
  totals: NutritionTotals
}

/** A day's live meals, newest first, each with its live items in order. */
export async function foodDay(db: GainframeDb, date: LocalDate): Promise<FoodDay> {
  const meals = await db.meals
    .where('localDate')
    .equals(date)
    .filter((meal) => meal.deletedAt === null)
    .toArray()
  const items = await db.mealItems
    .where('mealId')
    .anyOf(meals.map((meal) => meal.id))
    .filter((item) => item.deletedAt === null)
    .toArray()
  const withItems = meals
    .toSorted((a, b) => b.eatenAt.localeCompare(a.eatenAt))
    .map((meal) => {
      const own = items
        .filter((item) => item.mealId === meal.id)
        .toSorted((a, b) => a.position - b.position)
      return { meal, items: own, totals: nutritionTotals(own) }
    })
  return { meals: withItems, totals: nutritionTotals(withItems.flatMap((meal) => meal.items)) }
}

/**
 * The foods of every past meal, for the frequent and recent lists; a food the
 * user saved under the same name gives its figures (M3-12).
 */
export async function knownFoods(
  db: GainframeDb,
  order: 'frequent' | 'recent',
): Promise<PastFood[]> {
  return withLibraryPortions(
    pastFoods(await db.mealItems.toArray(), order),
    await db.foods.toArray(),
  )
}

/** The user's live foods and edits of table entries (M3-12). */
export async function savedFoods(db: GainframeDb): Promise<Food[]> {
  return currentFoods(await db.foods.toArray())
}

export type FoodValues = Omit<NewRow<Food>, 'tableId'>

/**
 * Saves a food: an own food by its id (a new one when `id` is null), or the
 * edit of a table entry, updating the current edit when there is one, so an
 * entry has one edit per device.
 */
export async function saveFood(
  db: GainframeDb,
  repos: Repositories,
  target: { id: string | null; tableId: string | null },
  values: FoodValues,
): Promise<Food> {
  return db.transaction('rw', db.foods, db.outbox, async () => {
    const edit =
      target.tableId === null
        ? undefined
        : currentFoods(await db.foods.where('tableId').equals(target.tableId).toArray())[0]
    const id = target.id ?? edit?.id
    if (id !== undefined) return repos.foods.update(id, values)
    return repos.foods.create({ ...values, tableId: target.tableId })
  })
}

/**
 * Deletes an own food, or every edit of a table entry, which restores the
 * entry as shipped. Logged meals keep their figures either way.
 */
export async function removeFood(
  db: GainframeDb,
  repos: Repositories,
  target: { id: string | null; tableId: string | null },
): Promise<void> {
  await db.transaction('rw', db.foods, db.outbox, async () => {
    const rows =
      target.tableId === null
        ? []
        : await db.foods.where('tableId').equals(target.tableId).toArray()
    const ids = new Set([...rows.map((row) => row.id), ...(target.id === null ? [] : [target.id])])
    for (const id of ids) await repos.foods.remove(id)
  })
}

export type NewMealItem = Omit<NewRow<MealItem>, 'mealId' | 'position'>

/**
 * Logs a meal and its items in one transaction, so a meal never syncs without
 * its items. The day it counts for is computed in `timeZone` at `eatenAt`.
 * `name` is the dish name an estimate gave; without one the first item names
 * the meal. `pendingPhotoId` is the kept photo the meal was estimated from,
 * deleted in the same transaction so the photo is never logged twice.
 */
export async function logMeal(
  db: GainframeDb,
  repos: Repositories,
  values: {
    eatenAt: string
    timeZone: string
    mealType: MealType
    name?: string | null
    items: NewMealItem[]
    pendingPhotoId?: string
  },
): Promise<Meal> {
  return db.transaction('rw', [db.meals, db.mealItems, db.outbox, db.pendingPhotos], async () => {
    const meal = await repos.meals.create({
      eatenAt: values.eatenAt,
      localDate: toLocalDate(values.eatenAt, values.timeZone),
      mealType: values.mealType,
      name: values.name ?? null,
      photoKey: null,
    })
    for (const [position, item] of values.items.entries()) {
      await repos.mealItems.create({ ...item, mealId: meal.id, position })
    }
    if (values.pendingPhotoId !== undefined) await db.pendingPhotos.delete(values.pendingPhotoId)
    return meal
  })
}
