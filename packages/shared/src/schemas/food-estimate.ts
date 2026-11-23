import { z } from 'zod'

// The photo estimate (M3-05): the device sends a re-encoded photo, the model
// names the foods it sees and their grams, and the server takes protein and
// energy from the bundled food table ("Food estimates" in docs/ai.md).

// Photo estimates per user and UTC day: the server's cap (`ai_usage`), and
// the number the device shows when it is reached.
export const FOOD_ESTIMATES_PER_DAY = 20

// The long edge, in pixels, the device scales a photo down to before sending it.
export const FOOD_PHOTO_LONG_EDGE_PX = 1568

// The largest photo the endpoint takes, decoded. The device re-encodes photos
// (long edge at most 1600 px, M3-03), which keeps a JPEG well under this.
const FOOD_PHOTO_BYTES_MAX = 1_500_000
// The same in base64, plus room for the rest of the JSON body.
export const FOOD_ESTIMATE_BODY_BYTES_MAX = Math.ceil(FOOD_PHOTO_BYTES_MAX / 3) * 4 + 1024

const foodPhotoTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp'])

// POST /api/food/estimate
export const foodEstimateRequestSchema = z.object({
  photo: z.object({
    type: foodPhotoTypeSchema,
    base64: z.base64().max(Math.ceil(FOOD_PHOTO_BYTES_MAX / 3) * 4),
  }),
})

const estimateConfidenceSchema = z.enum(['high', 'medium', 'low'])

// The most items and alternatives one estimate holds.
const ESTIMATE_ITEMS_MAX = 12
const ESTIMATE_ALTERNATIVES_MAX = 4

// One food as the model returns it. `entryId` is a food table id, or null when
// nothing in the table fits; only then does the model give per-100 g figures.
// `seen` is what the model saw, in its own words ("what the model saw" on the
// correction sheet). The numeric limits are checked by Zod, not by the model's
// output format, which does not support them.
const visionItemSchema = z.object({
  seen: z.string().min(1).max(120),
  entryId: z.string().nullable(),
  grams: z.number().positive().max(3000),
  confidence: estimateConfidenceSchema,
  alternativeIds: z.array(z.string()).max(ESTIMATE_ALTERNATIVES_MAX),
  proteinPer100G: z.number().min(0).max(100).nullable(),
  kcalPer100G: z.number().min(0).max(900).nullable(),
})

// Why a photo cannot be counted well (prompt v2): the device turns it into
// advice on retaking it.
export const photoIssueSchema = z.enum(['no_food', 'dark', 'blurry', 'cut_off'])

// The model's whole reply. No items means no food could be named; then
// `photoIssue` says why.
export const visionReplySchema = z.object({
  dishName: z.string().min(1).max(120).nullable(),
  photoIssue: photoIssueSchema.nullable(),
  items: z.array(visionItemSchema).max(ESTIMATE_ITEMS_MAX),
})

// The oil and sauce choice on the confirm screen (M3-06): the model cannot see
// either, so the user says whether the dish had less, the usual or more.
export const oilSauceSchema = z.enum(['less', 'usual', 'more'])

// A meal item's `aiRaw` for an estimated item: the model's item, whether the
// user kept "remember this correction" on when correcting it, and the meal's
// oil and sauce choice (M3-06). Remembered corrections are sent with later
// estimates as reference.
export const estimateAiRawSchema = visionItemSchema.extend({
  remember: z.boolean(),
  oilSauce: oilSauceSchema,
})

export type VisionItem = z.infer<typeof visionItemSchema>
export type EstimateAiRaw = z.infer<typeof estimateAiRawSchema>
export type OilSauce = z.infer<typeof oilSauceSchema>
export type VisionReply = z.infer<typeof visionReplySchema>
export type PhotoIssue = z.infer<typeof photoIssueSchema>

// One estimated item as the endpoint returns it: protein and energy for the
// estimated grams, computed in code. `nutrients` says where the figures came
// from: `table` (the entry's per-100 g values) or `model` (no entry fitted, so
// the model's own figures, tagged as such on the confirm screen). `raw` is the
// model's item unchanged; the confirm screen stores it, with `remember`, as
// the meal item's `aiRaw`.
const foodEstimateItemSchema = z.object({
  name: z.string().min(1).max(120),
  entryId: z.string().nullable(),
  grams: z.number().positive(),
  proteinG: z.number().min(0),
  kcal: z.number().min(0),
  nutrients: z.enum(['table', 'model']),
  confidence: estimateConfidenceSchema,
  alternativeIds: z.array(z.string()),
  raw: visionItemSchema,
})

export const foodEstimateResponseSchema = z.object({
  dishName: z.string().nullable(),
  photoIssue: photoIssueSchema.nullable(),
  items: z.array(foodEstimateItemSchema),
  model: z.string(),
  promptVersion: z.int().positive(),
})

export type FoodEstimateItem = z.infer<typeof foodEstimateItemSchema>
export type FoodEstimateRequest = z.infer<typeof foodEstimateRequestSchema>
export type FoodEstimateResponse = z.infer<typeof foodEstimateResponseSchema>
