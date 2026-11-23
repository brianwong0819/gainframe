import { z } from 'zod'

// The databases the bundled food table draws on, credited in the app and in
// docs/design/credits.md.
export const foodTableSourceSchema = z.enum(['myfcd', 'usda'])

// One food of the bundled table. Nutrients are per 100 g of edible portion;
// `servingG` is a typical portion, only the starting grams when it is logged.
// An id is permanent once released: estimates and meal items refer to it.
export const foodTableEntrySchema = z.object({
  id: z.string().regex(/^(myfcd|usda)-[A-Za-z0-9]+$/),
  nameEn: z.string().min(1),
  nameZh: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  proteinPer100G: z.number().min(0).max(100),
  kcalPer100G: z.number().min(0).max(900),
  servingG: z.number().int().positive().max(1000),
  source: foodTableSourceSchema,
})

export type FoodTableEntry = z.infer<typeof foodTableEntrySchema>

const nutrient = z.number().min(0).nullable()

// A row of sources/myfcd.json, read from MyFCD's food pages.
export const myfcdRowSchema = z.object({
  database: z.enum(['FCD1997', 'myfcd97', 'current']),
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  ediblePortionG: z.number().nullable(),
  kcal: z.number().min(0),
  proteinG: z.number().min(0),
  fatG: nutrient,
  carbG: nutrient,
  servings: z.array(z.object({ label: z.string(), grams: z.number() })),
  sourceUrl: z.url(),
})

// A row of sources/usda.json, read from FoodData Central's SR Legacy release.
export const usdaRowSchema = z.object({
  fdcId: z.number().int().positive(),
  description: z.string().min(1),
  kcal: z.number().min(0),
  proteinG: z.number().min(0),
  fatG: nutrient,
  carbG: nutrient,
  sourceUrl: z.url(),
})

export type MyfcdRow = z.infer<typeof myfcdRowSchema>
export type UsdaRow = z.infer<typeof usdaRowSchema>
