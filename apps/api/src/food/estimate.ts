import {
  type EstimateAiRaw,
  estimateAiRawSchema,
  type Food,
  foodSchema,
  type FoodTableEntry,
  type TextEstimateRequest,
  type TextMealReply,
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
import * as textMealV2 from '../../prompts/text-meal/v2.ts'
import * as visionV2 from '../../prompts/vision/v2.ts'
import * as visionV3 from '../../prompts/vision/v3.ts'
import { aiConfig } from '../ai/config.ts'
import type { Database } from '../db/client.ts'
import { foods, mealItems } from '../db/schema.ts'

const FOOD_ENTRIES: ReadonlyMap<string, FoodTableEntry> = new Map(
  FOOD_TABLE.map((entry) => [entry.id, entry]),
)

// How a prompt version names table entries, and back. Since vision v3 and
// text-meal v2 an entry is its position in the table ("1", "2" …), a token or
// two instead of the eight or so of an id like `sgfoodid-F05040011`. The
// numbers only live within one request: replies are mapped back to table ids
// before anything stores or counts them.
export interface PromptIds {
  toPrompt: (tableId: string) => string
  // Undefined for a name the table does not have.
  toTable: (promptId: string) => string | undefined
}

const TABLE_IDS: PromptIds = {
  toPrompt: (id) => id,
  toTable: (id) => (FOOD_ENTRIES.has(id) ? id : undefined),
}

const POSITIONS: ReadonlyMap<string, string> = new Map(
  FOOD_TABLE.map((entry, index) => [entry.id, String(index + 1)]),
)

const POSITION_IDS: PromptIds = {
  toPrompt: (id) => {
    const position = POSITIONS.get(id)
    if (position === undefined) throw new Error(`No food table entry ${id}`)
    return position
  },
  toTable: (position) =>
    /^[1-9]\d*$/.test(position) ? FOOD_TABLE[Number(position) - 1]?.id : undefined,
}

// Entry names only, never nutrients: the model picks an entry instead of
// inventing figures ("Food estimates" in docs/ai.md).
const tableLines = (ids: PromptIds) =>
  FOOD_TABLE.map((entry) =>
    [ids.toPrompt(entry.id), entry.nameEn, ...entry.aliases].join('\t'),
  ).join('\n')

// The reply format, plus the checks against the table that the output format
// cannot express; a failed check goes back to the model for its one retry.
function tableIssues(ids: PromptIds) {
  return (reply: Pick<VisionReply, 'items'>, ctx: z.RefinementCtx) => {
    for (const issue of visionReplyIssues(reply, (id) => ids.toTable(id) !== undefined)) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
    }
  }
}

// A checked reply with the prompt's names replaced by table ids, so the
// stored `aiRaw` and the figures use the table's own ids.
function withTableIds<R extends Pick<VisionReply, 'items'>>(ids: PromptIds) {
  return (reply: R): R => ({
    ...reply,
    items: reply.items.map((item) => ({
      ...item,
      // The reply schema has checked that the entry exists.
      entryId: item.entryId === null ? null : (ids.toTable(item.entryId) ?? null),
      alternativeIds: item.alternativeIds.flatMap((id) => ids.toTable(id) ?? []),
    })),
  })
}

function versionOf<P>(prompts: Readonly<Record<number, P>>, version: number, feature: string): P {
  const prompt = prompts[version]
  if (prompt === undefined) throw new Error(`No ${feature} prompt version ${String(version)}`)
  return prompt
}

// The prompt versions of the photo estimate; config chooses one.
const VISION_PROMPTS: Readonly<Record<number, { prompt: typeof visionV3; ids: PromptIds }>> = {
  2: { prompt: visionV2, ids: TABLE_IDS },
  3: { prompt: visionV3, ids: POSITION_IDS },
}

// The prompt versions `pnpm eval:vision` can compare.
export const VISION_PROMPT_VERSIONS: readonly number[] = Object.keys(VISION_PROMPTS).map(Number)

// A photo prompt version: its system prompt, its reply schema and the mapping
// of a checked reply to table ids.
function visionVersion(version: number) {
  const { prompt, ids } = versionOf(VISION_PROMPTS, version, 'vision')
  return {
    prompt,
    ids,
    system: prompt.system(tableLines(ids)),
    schema: visionReplySchema.superRefine(tableIssues(ids)),
    toTableIds: withTableIds<VisionReply>(ids),
  }
}

const vision = visionVersion(aiConfig.features.vision.promptVersion)

export const VISION_SYSTEM = vision.system
export const estimateReplySchema = vision.schema
export const visionIds: PromptIds = vision.ids
export const visionReplyToTable = vision.toTableIds

// A photo prompt version's system prompt, request text without corrections,
// reply schema and id mapping, for the eval.
export function visionPromptFor(version: number) {
  const chosen = visionVersion(version)
  return {
    system: chosen.system,
    request: chosen.prompt.request([]),
    schema: chosen.schema,
    toTableIds: chosen.toTableIds,
  }
}

// The prompt versions of the text estimate (M3-10); config chooses one.
const TEXT_MEAL_PROMPTS: Readonly<Record<number, { prompt: typeof textMealV2; ids: PromptIds }>> = {
  1: { prompt: textMealV1, ids: TABLE_IDS },
  2: { prompt: textMealV2, ids: POSITION_IDS },
}

const textMeal = versionOf(TEXT_MEAL_PROMPTS, aiConfig.features.textMeal.promptVersion, 'text-meal')

export const TEXT_MEAL_SYSTEM = textMeal.prompt.system(tableLines(textMeal.ids))
export const textMealReplyCheckedSchema = textMealReplySchema.superRefine(tableIssues(textMeal.ids))
export const textMealReplyToTable = withTableIds<TextMealReply>(textMeal.ids)

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

const entryLabel = (ids: PromptIds, id: string | null, seen: string) => {
  const entry = id === null ? undefined : FOOD_ENTRIES.get(id)
  return entry === undefined ? `"${seen}"` : `${ids.toPrompt(entry.id)} "${entry.nameEn}"`
}

// One line per correction for the prompt, naming entries as the prompt does.
export function correctionLines(ids: PromptIds, corrections: readonly Correction[]): string[] {
  return corrections.map(({ estimate, name, grams }) => {
    const before = `${entryLabel(ids, estimate.entryId, estimate.seen)}, ${String(estimate.grams)} g`
    return `you saw "${estimate.seen}" and estimated ${before}; the user logged "${name}", ${String(grams)} g`
  })
}

export const visionRequest = (corrections: readonly Correction[]) =>
  vision.prompt.request(correctionLines(vision.ids, corrections))

export const textMealRequest = (request: TextEstimateRequest, corrections: readonly Correction[]) =>
  textMeal.prompt.request(
    request.text,
    request.locale,
    request.answers,
    correctionLines(textMeal.ids, corrections),
  )
