import {
  type LocalDate,
  type Meal,
  type MealItem,
  type MealType,
  nutritionTotals,
  type NutritionTotals,
  pastFoods,
  type PastFood,
  toLocalDate,
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

/** The foods of every past meal, for the frequent and recent lists. */
export async function knownFoods(
  db: GainframeDb,
  order: 'frequent' | 'recent',
): Promise<PastFood[]> {
  return pastFoods(await db.mealItems.toArray(), order)
}

export type NewMealItem = Omit<NewRow<MealItem>, 'mealId' | 'position'>

/**
 * Logs a meal and its items in one transaction, so a meal never syncs without
 * its items. The day it counts for is computed in `timeZone` at `eatenAt`.
 */
export async function logMeal(
  db: GainframeDb,
  repos: Repositories,
  values: { eatenAt: string; timeZone: string; mealType: MealType; items: NewMealItem[] },
): Promise<Meal> {
  return db.transaction('rw', db.meals, db.mealItems, db.outbox, async () => {
    const meal = await repos.meals.create({
      eatenAt: values.eatenAt,
      localDate: toLocalDate(values.eatenAt, values.timeZone),
      mealType: values.mealType,
      name: null,
      photoKey: null,
    })
    for (const [position, item] of values.items.entries()) {
      await repos.mealItems.create({ ...item, mealId: meal.id, position })
    }
    return meal
  })
}
