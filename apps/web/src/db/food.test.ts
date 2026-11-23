import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { localDateSchema } from '@gainframe/shared'

import {
  foodDay,
  type FoodValues,
  knownFoods,
  logMeal,
  type NewMealItem,
  removeFood,
  saveFood,
  savedFoods,
} from './food'
import { createRepositories } from './repositories'
import { GainframeDb } from './schema'

const KL = 'Asia/Kuala_Lumpur'
const day = localDateSchema.parse('2026-11-22')

let db: GainframeDb
let clock: Date
let repos: ReturnType<typeof createRepositories>

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  clock = new Date('2026-11-22T04:00:00.000Z')
  repos = createRepositories(db, () => clock)
})

afterEach(() => {
  db.close()
})

const food = (name: string, proteinG: number, kcal: number): NewMealItem => ({
  name,
  grams: 100,
  proteinG,
  kcal,
  source: 'manual',
  aiRaw: null,
})

describe('food log', () => {
  it('logs a meal with its items in order and counts it for the local day', async () => {
    // 23:30 UTC on the 21st is 07:30 on the 22nd in Kuala Lumpur.
    const meal = await logMeal(db, repos, {
      eatenAt: '2026-11-21T23:30:00.000Z',
      timeZone: KL,
      mealType: 'breakfast',
      items: [food('Egg', 6, 70), food('Toast', 4, 120)],
    })
    expect(meal.localDate).toBe('2026-11-22')

    const { meals, totals } = await foodDay(db, day)
    expect(meals.map(({ items }) => items.map((item) => item.name))).toEqual([['Egg', 'Toast']])
    expect(totals).toEqual({ proteinG: 10, kcal: 190 })
    expect(await db.outbox.count()).toBe(3)
  })

  it('lists the newest meal first and leaves out deleted meals', async () => {
    const lunch = await logMeal(db, repos, {
      eatenAt: '2026-11-22T04:00:00.000Z',
      timeZone: KL,
      mealType: 'lunch',
      items: [food('Chicken rice', 32, 610)],
    })
    clock = new Date('2026-11-22T11:00:00.000Z')
    const dinner = await logMeal(db, repos, {
      eatenAt: '2026-11-22T11:00:00.000Z',
      timeZone: KL,
      mealType: 'dinner',
      items: [food('Fish soup', 28, 350)],
    })
    const snack = await logMeal(db, repos, {
      eatenAt: '2026-11-22T08:00:00.000Z',
      timeZone: KL,
      mealType: 'snack',
      items: [food('Milo', 3, 120)],
    })
    await repos.meals.remove(snack.id)

    const { meals, totals } = await foodDay(db, day)
    expect(meals.map(({ meal }) => meal.id)).toEqual([dinner.id, lunch.id])
    expect(totals).toEqual({ proteinG: 60, kcal: 960 })
    expect((await knownFoods(db, 'recent')).map((known) => known.name)).toEqual([
      'Fish soup',
      'Chicken rice',
    ])
  })
})

const scoop = (proteinPer100G: number): FoodValues => ({
  name: 'Whey',
  proteinPer100G,
  kcalPer100G: 371,
  servings: [{ label: '1 scoop', grams: 35 }],
})
const wheyEntry = { id: null, tableId: 'usda-173180' }

describe('food library', () => {
  it('keeps one edit per table entry and queues each change for sync', async () => {
    const first = await saveFood(db, repos, wheyEntry, scoop(60))
    clock = new Date('2026-11-22T05:00:00.000Z')
    const second = await saveFood(db, repos, wheyEntry, scoop(68.6))
    expect(second.id).toBe(first.id)
    expect(await savedFoods(db)).toEqual([second])
    expect((await db.outbox.toArray()).filter((entry) => entry.table === 'foods')).toHaveLength(2)
  })

  it('restores a table entry by deleting its edits', async () => {
    await saveFood(db, repos, wheyEntry, scoop(68.6))
    await removeFood(db, repos, wheyEntry)
    expect(await savedFoods(db)).toEqual([])
    expect((await db.foods.toArray()).every((row) => row.deletedAt !== null)).toBe(true)
  })

  it('creates and deletes an own food', async () => {
    const own = await saveFood(db, repos, { id: null, tableId: null }, scoop(70))
    expect(own.tableId).toBeNull()
    await removeFood(db, repos, { id: own.id, tableId: null })
    expect(await savedFoods(db)).toEqual([])
  })

  it('gives a frequent food the figures of the saved food of that name, past meals unchanged', async () => {
    await logMeal(db, repos, {
      eatenAt: '2026-11-22T04:00:00.000Z',
      timeZone: KL,
      mealType: 'snack',
      items: [{ ...food('Whey', 17, 108), grams: 30 }],
    })
    await saveFood(db, repos, wheyEntry, scoop(68.6))

    const [frequent] = await knownFoods(db, 'frequent')
    expect(frequent?.grams).toBe(30)
    expect(frequent?.proteinG).toBeCloseTo(20.58, 2)
    expect((await foodDay(db, day)).totals).toEqual({ proteinG: 17, kcal: 108 })
  })
})
