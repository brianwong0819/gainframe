import { z } from 'zod'

// The body of every API error response. `requestId` matches the `x-request-id`
// header and the server's log lines for the request.
export const apiErrorSchema = z.object({
  error: z.object({
    // update_required: the app's sync version is no longer supported.
    code: z.enum([
      'invalid_request',
      'unauthorized',
      'not_found',
      'update_required',
      'internal_error',
    ]),
    message: z.string(),
    requestId: z.string(),
  }),
})

export type ApiError = z.infer<typeof apiErrorSchema>
