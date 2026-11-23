import { z } from 'zod'

// The body of every API error response. `requestId` matches the `x-request-id`
// header and the server's log lines for the request.
export const apiErrorSchema = z.object({
  error: z.object({
    // update_required: the app's sync version is no longer supported.
    // ai_capped: the user's daily AI calls for the feature are used up.
    // ai_refused: the model declined the request. ai_failed: the model timed
    // out, failed or gave no valid answer; the request can be retried.
    code: z.enum([
      'invalid_request',
      'unauthorized',
      'not_found',
      'update_required',
      'ai_capped',
      'ai_refused',
      'ai_failed',
      'internal_error',
    ]),
    message: z.string(),
    requestId: z.string(),
  }),
})

export type ApiError = z.infer<typeof apiErrorSchema>
