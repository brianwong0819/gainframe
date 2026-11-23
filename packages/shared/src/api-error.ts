import { z } from 'zod'

// The body of every API error response. `requestId` matches the `x-request-id`
// header and the server's log lines for the request.
export const apiErrorSchema = z.object({
  error: z.object({
    // update_required: the app's sync version is no longer supported.
    // ai_not_enabled: the user is not allowed the AI features (AI_GROUP).
    // ai_capped: the user's daily AI calls for the feature are used up.
    // ai_refused: the model declined the request. ai_unavailable: the model
    // could not be reached (an outage or missing model access); a retry soon
    // will not help. ai_timeout: the model took too long. ai_failed: the model
    // gave no valid answer. The last two can be retried.
    code: z.enum([
      'invalid_request',
      'unauthorized',
      'not_found',
      'update_required',
      'ai_not_enabled',
      'ai_capped',
      'ai_refused',
      'ai_unavailable',
      'ai_timeout',
      'ai_failed',
      'internal_error',
    ]),
    message: z.string(),
    requestId: z.string(),
  }),
})

export type ApiError = z.infer<typeof apiErrorSchema>
