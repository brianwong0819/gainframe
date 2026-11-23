import type { Food, FoodServing } from '../schemas/food.ts'
import type { FoodTableEntry, FoodTableSource } from '../schemas/food-table.ts'
import type { PastFood } from './nutrition.ts'

// table: a bundled entry as shipped. edited: an entry with the user's edit.
// own: a food the user created.
export type FoodOrigin = 'table' | 'edited' | 'own'

// A food as the user's library shows it (M3-12): the bundled table with the
// user's edits in place of the entries they replace, and the user's own foods.
// `key` is the table entry id, or the food's id for an own food. `name` is in
// the app's language; `nameZh`, `nameEn` and `aliases` are what search reads,
// so an edited entry is still found by its original names.
export interface LibraryFood {
  key: string
  origin: FoodOrigin
  tableId: string | null
  foodId: string | null
  source: FoodTableSource | null
  name: string
  nameZh: string | null
  nameEn: string | null
  aliases: readonly string[]
  proteinPer100G: number
  kcalPer100G: number
  servings: readonly FoodServing[]
}

export interface Portion {
  grams: number
  proteinG: number
  kcal: number
}

// The user's live foods, keeping only the latest edit of each table entry:
// two devices that edited the same entry before syncing both hold a row.
export function currentFoods(foods: readonly Food[]): Food[] {
  const latest = new Map<string, Food>()
  for (const food of foods) {
    if (food.deletedAt !== null) continue
    const key = food.tableId ?? food.id
    const known = latest.get(key)
    if (known === undefined || food.updatedAt > known.updatedAt) latest.set(key, food)
  }
  return [...latest.values()]
}

function tableServing(entry: FoodTableEntry, locale: 'zh' | 'en'): FoodServing {
  return { label: entry.servingLabel?.[locale] ?? null, grams: entry.servingG }
}

// The library in the app's language: the user's own foods, newest first, then
// the table in its order with each edited entry replaced by the user's edit.
export function foodLibrary(
  table: readonly FoodTableEntry[],
  foods: readonly Food[],
  locale: 'zh' | 'en',
): LibraryFood[] {
  const current = currentFoods(foods)
  const edits = new Map(current.flatMap((food) => (food.tableId ? [[food.tableId, food]] : [])))
  const own = current
    .filter((food) => food.tableId === null)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((food): LibraryFood => ({
      key: food.id,
      origin: 'own',
      tableId: null,
      foodId: food.id,
      source: null,
      name: food.name,
      nameZh: food.name,
      nameEn: null,
      aliases: [],
      proteinPer100G: food.proteinPer100G,
      kcalPer100G: food.kcalPer100G,
      servings: food.servings,
    }))
  const fromTable = table.map((entry): LibraryFood => {
    const edit = edits.get(entry.id)
    const names = {
      key: entry.id,
      tableId: entry.id,
      source: entry.source,
      nameZh: entry.nameZh,
      nameEn: entry.nameEn,
    }
    if (edit === undefined) {
      return {
        ...names,
        origin: 'table',
        foodId: null,
        name: locale === 'zh' ? entry.nameZh : entry.nameEn,
        aliases: entry.aliases,
        proteinPer100G: entry.proteinPer100G,
        kcalPer100G: entry.kcalPer100G,
        servings: [tableServing(entry, locale)],
      }
    }
    return {
      ...names,
      origin: 'edited',
      foodId: edit.id,
      name: edit.name,
      aliases: [...entry.aliases, edit.name],
      proteinPer100G: edit.proteinPer100G,
      kcalPer100G: edit.kcalPer100G,
      servings: edit.servings,
    }
  })
  return [...own, ...fromTable]
}

// A portion of `grams` of a food whose figures are per 100 g.
export function portionOf(
  food: Pick<LibraryFood, 'proteinPer100G' | 'kcalPer100G'>,
  grams: number,
): Portion {
  return {
    grams,
    proteinG: (food.proteinPer100G * grams) / 100,
    kcal: (food.kcalPer100G * grams) / 100,
  }
}

// Figures per 100 g from one portion, as a nutrition label gives them per
// serving ("24 g protein per 31 g scoop").
export function per100G(portion: Portion): Pick<Food, 'proteinPer100G' | 'kcalPer100G'> {
  return {
    proteinPer100G: (portion.proteinG * 100) / portion.grams,
    kcalPer100G: (portion.kcal * 100) / portion.grams,
  }
}

const nameKey = (name: string) => name.trim().toLocaleLowerCase()

// Past foods (derived from meal items) whose name is a food in the user's
// library take that food's figures for the amount last eaten, so an edit
// reaches the frequent and recent lists too; how much, how often and when a
// food was eaten stay as they were.
export function withLibraryPortions(past: readonly PastFood[], foods: readonly Food[]): PastFood[] {
  const byName = new Map(currentFoods(foods).map((food) => [nameKey(food.name), food]))
  return past.map((item) => {
    const food = byName.get(nameKey(item.name))
    return food === undefined ? item : { ...item, ...portionOf(food, item.grams) }
  })
}
