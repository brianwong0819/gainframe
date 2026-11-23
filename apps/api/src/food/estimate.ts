import {
  type EstimateAiRaw,
  estimateAiRawSchema,
  type Food,
  foodSchema,
  type FoodTableEntry,
  type TextEstimateRequest,
  textMealReplySchema,
  type VisionReply,
  visionReplyIssues,
  visionReplySchema,
  withFoodEdits,
} from '@gainframe/shared'
import { FOOD_TABLE } from '@gainframe/shared/food-table'
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { z } from 'zod'

import * as textMealV1 from '../../prompts/text-meal/v1.ts'
import * as visionV2 from '../../prompts/vision/v2.ts'
import { aiConfig } from '../ai/config.ts'
import type { Database } from '../db/client.ts'
import { foods, mealItems } from '../db/schema.ts'

const FOOD_ENTRIES: ReadonlyMap<string, FoodTableEntry> = new Map(
  FOOD_TABLE.map((entry) => [entry.id, entry]),
)

// The prompt versions of the photo estimate; config chooses one.
const VISION_PROMPTS: Readonly<Record<number, typeof visionV2>> = { 2: visionV2 }

function visionPrompt(version: number): typeof visionV2 {
  const prompt = VISION_PROMPTS[version]
  if (prompt === undefined) throw new Error(`No vision prompt version ${String(version)}`)
  return prompt
}

const prompt = visionPrompt(aiConfig.features.vision.promptVersion)

// Ids and names only, never nutrients: the model picks an entry instead of
// inventing figures ("Food estimates" in docs/ai.md).
const FOOD_TABLE_LINES = FOOD_TABLE.map((entry) =>
  [entry.id, entry.nameEn, ...entry.aliases].join('\t'),
).join('\n')

export const VISION_SYSTEM = prompt.system(FOOD_TABLE_LINES)

// The prompt versions of the text estimate (M3-10); config chooses one.
const TEXT_MEAL_PROMPTS: Readonly<Record<number, typeof textMealV1>> = { 1: textMealV1 }
const textPrompt = TEXT_MEAL_PROMPTS[aiConfig.features.textMeal.promptVersion]
if (textPrompt === undefined) {
  throw new Error(`No text-meal prompt version ${String(aiConfig.features.textMeal.promptVersion)}`)
}

export const TEXT_MEAL_SYSTEM = textPrompt.system(FOOD_TABLE_LINES)

// The reply format, plus the checks against the table that the output format
// cannot express; a failed check goes back to the model for its one retry.
function tableIssues(reply: Pick<VisionReply, 'items'>, ctx: z.RefinementCtx) {
  for (const issue of visionReplyIssues(reply, (id) => FOOD_ENTRIES.has(id))) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
  }
}

export const estimateReplySchema = visionReplySchema.superRefine(tableIssues)
export const textMealReplyCheckedSchema = textMealReplySchema.superRefine(tableIssues)

// The table as this user sees it: their live edits of entries (M3-12) replace
// the entries' names and figures. Scoped by the user from the token; a row that
// does not parse is skipped.
export async function userEntries(
  db: Database,
  userId: string,
): Promise<ReadonlyMap<string, FoodTableEntry>> {
  const rows = await db
    .select()
    .from(foods)
    .where(and(eq(foods.userId, userId), isNull(foods.deletedAt), isNotNull(foods.tableId)))
  const edits = rows.flatMap((row): Food[] => {
    const food = foodSchema.safeParse(row)
    return food.success ? [food.data] : []
  })
  return withFoodEdits(FOOD_ENTRIES, edits)
}

export interface Correction {
  // What the model estimated, and what the user logged instead.
  estimate: EstimateAiRaw
  name: string
  grams: number
}

// The user's most recent remembered corrections: estimated items they changed
// with "remember this correction" on (M3-06 stores the flag in `aiRaw`). Scoped
// by the user from the token; a row whose `aiRaw` does not parse is skipped.
export async function recentCorrections(db: Database, userId: string): Promise<Correction[]> {
  const rows = await db
    .select({ name: mealItems.name, grams: mealItems.grams, aiRaw: mealItems.aiRaw })
    .from(mealItems)
    .where(
      and(
        eq(mealItems.userId, userId),
        eq(mealItems.source, 'ai'),
        isNull(mealItems.deletedAt),
        sql`${mealItems.aiRaw} ->> 'remember' = 'true'`,
      ),
    )
    .orderBy(desc(mealItems.updatedAt))
    .limit(aiConfig.visionCorrectionsMax)
  return rows.flatMap((row) => {
    const estimate = estimateAiRawSchema.safeParse(row.aiRaw)
    return estimate.success ? [{ estimate: estimate.data, name: row.name, grams: row.grams }] : []
  })
}

const entryLabel = (id: string | null, seen: string) => {
  const entry = id === null ? undefined : FOOD_ENTRIES.get(id)
  return entry === undefined ? `"${seen}"` : `${entry.id} "${entry.nameEn}"`
}

// One line per correction for the prompt.
export function correctionLines(corrections: readonly Correction[]): string[] {
  return corrections.map(({ estimate, name, grams }) => {
    const before = `${entryLabel(estimate.entryId, estimate.seen)}, ${String(estimate.grams)} g`
    return `you saw "${estimate.seen}" and estimated ${before}; the user logged "${name}", ${String(grams)} g`
  })
}

export const visionRequest = (corrections: readonly Correction[]) =>
  prompt.request(correctionLines(corrections))

export const textMealRequest = (request: TextEstimateRequest, corrections: readonly Correction[]) =>
  textPrompt.request(request.text, request.locale, request.answers, correctionLines(corrections))
