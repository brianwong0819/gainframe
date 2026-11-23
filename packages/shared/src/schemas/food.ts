import { z } from 'zod'

import { foodTableEntrySchema } from './food-table.ts'
import { instantSchema, localDateSchema, syncedRowSchema } from './row.ts'

export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])

// Where an item's figures came from. ai: a photo or text estimate (M3-05,
// M3-10), possibly corrected. manual: typed by the user, usually from a
// nutrition label. frequent: copied from an earlier item with one tap. table:
// a serving of a bundled food table entry (M3-11).
export const mealItemSourceSchema = z.enum(['ai', 'manual', 'frequent', 'table'])

// The largest stored model output for one item, as JSON text. An estimate holds
// a name, its figures and a few alternative names, well under this.
const AI_RAW_MAX_CHARS = 4000

// A meal: when it was eaten, the day it counts for and its type. `name` is the
// dish name a model gave ("chicken rice"); null means the first item names the
// meal. `photoKey` is the photo's S3 object key (M3-03), null without a photo.
// The figures live on the items; a meal's totals are their sum.
export const mealSchema = syncedRowSchema.extend({
  eatenAt: instantSchema,
  localDate: localDateSchema,
  mealType: mealTypeSchema,
  name: z.string().trim().min(1).max(120).nullable(),
  photoKey: z.string().min(1).max(200).nullable(),
})

// One food in a meal, ordered by `position`. `grams` is the portion eaten and
// `proteinG` and `kcal` are for that portion. `aiRaw` keeps the model's own
// estimate for the item, before any correction, so corrections can be learned
// from (M3-05) and errors measured (M3-08); null for an item the model did not
// estimate. Frequent and recent foods are derived from these rows.
export const mealItemSchema = syncedRowSchema.extend({
  mealId: z.uuid(),
  position: z.int().min(0),
  name: z.string().trim().min(1).max(120),
  grams: z.number().positive().max(5000),
  proteinG: z.number().min(0).max(1000),
  kcal: z.number().min(0).max(20000),
  source: mealItemSourceSchema,
  aiRaw: z
    .record(z.string(), z.json())
    .refine((raw) => JSON.stringify(raw).length <= AI_RAW_MAX_CHARS, {
      message: `The stored estimate is longer than ${String(AI_RAW_MAX_CHARS)} characters`,
    })
    .nullable(),
})

// A named portion of a food: "1 scoop" of 31 g. A null label is the food's
// usual portion, shown by its grams alone.
export const foodServingSchema = z.object({
  label: z.string().trim().min(1).max(40).nullable(),
  grams: z.number().positive().max(2000),
})

// A food in the user's library (M3-12): their own food (`tableId` null), or
// their edit of a bundled food table entry, which replaces that entry for them
// wherever the table is read; deleting the edit restores the entry. Figures are
// per 100 g like the table's; the first serving is the one a tap adds. A meal
// item copies a portion's figures when it is logged, so editing a food never
// changes a logged meal.
export const foodSchema = syncedRowSchema.extend({
  tableId: foodTableEntrySchema.shape.id.nullable(),
  name: z.string().trim().min(1).max(120),
  proteinPer100G: z.number().min(0).max(100),
  kcalPer100G: z.number().min(0).max(900),
  servings: z.array(foodServingSchema).min(1).max(6),
})

export type MealType = z.infer<typeof mealTypeSchema>
export type MealItemSource = z.infer<typeof mealItemSourceSchema>
export type Meal = z.infer<typeof mealSchema>
export type MealItem = z.infer<typeof mealItemSchema>
export type FoodServing = z.infer<typeof foodServingSchema>
export type Food = z.infer<typeof foodSchema>
