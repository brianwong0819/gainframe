import {
  type ApiError,
  FOOD_ESTIMATE_BODY_BYTES_MAX,
  foodEstimateRequestSchema,
  type FoodEstimateResponse,
  resolveEstimate,
} from '@gainframe/shared'
import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import type { AiResult, createAi } from '../ai/generate.ts'
import type { AppEnv } from '../context.ts'
import type { Database } from '../db/client.ts'
import { errorBody } from '../error-body.ts'
import {
  estimateReplySchema,
  recentCorrections,
  userEntries,
  VISION_SYSTEM,
  visionRequest,
} from '../food/estimate.ts'

type Failure = Exclude<AiResult<unknown>, { ok: true }>['outcome']

// How each failed call reaches the device. The confirm screen (M3-06) shows a
// state for each code; every one keeps the photo and offers manual entry.
const FAILURES: Record<
  Failure,
  { status: ContentfulStatusCode; code: ApiError['error']['code']; message: string }
> = {
  capped: { status: 429, code: 'ai_capped', message: 'Daily estimate limit reached' },
  refused: { status: 422, code: 'ai_refused', message: 'The model declined this photo' },
  timeout: { status: 504, code: 'ai_timeout', message: 'The estimate took too long' },
  invalid: { status: 502, code: 'ai_failed', message: 'The estimate was not usable' },
  provider_error: {
    status: 503,
    code: 'ai_unavailable',
    message: 'The model could not be reached',
  },
}

// POST /api/food/estimate (M3-05): the foods in a meal photo, with grams from
// the model and protein and energy from the bundled food table, with the
// user's own edits of its entries applied. The user comes
// from the token, never from the body; the photo is not stored or logged.
export function foodRoutes(db: Database, generate: ReturnType<typeof createAi>) {
  return new Hono<AppEnv>().post(
    '/estimate',
    bodyLimit({
      maxSize: FOOD_ESTIMATE_BODY_BYTES_MAX,
      onError: (c: Context<AppEnv>) =>
        c.json(errorBody('invalid_request', 'Photo too large', c.var.requestId), 413),
    }),
    async (c) => {
      const { userId } = c.var
      if (userId === undefined) throw new Error('food route reached without requireUser')
      const body = foodEstimateRequestSchema.safeParse(await c.req.json().catch(() => undefined))
      if (!body.success) {
        return c.json(errorBody('invalid_request', 'Invalid photo', c.var.requestId), 400)
      }
      const [corrections, entries] = await Promise.all([
        recentCorrections(db, userId),
        userEntries(db, userId),
      ])
      const result = await generate({
        feature: 'vision',
        userId,
        log: c.var.log,
        system: VISION_SYSTEM,
        content: [
          { type: 'image', mediaType: body.data.photo.type, data: body.data.photo.base64 },
          { type: 'text', text: visionRequest(corrections) },
        ],
        schema: estimateReplySchema,
      })
      if (!result.ok) {
        const failure = FAILURES[result.outcome]
        return c.json(errorBody(failure.code, failure.message, c.var.requestId), failure.status)
      }
      const response: FoodEstimateResponse = {
        dishName: result.value.dishName,
        photoIssue: result.value.photoIssue,
        items: resolveEstimate(result.value, entries),
        model: result.model,
        promptVersion: result.promptVersion,
      }
      return c.json(response)
    },
  )
}
