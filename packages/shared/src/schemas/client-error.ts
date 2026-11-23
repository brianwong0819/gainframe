import { z } from 'zod'

import { instantSchema } from './row.ts'

// Where a client error was caught: a React error boundary, the window `error`
// event, an unhandled promise rejection, or an API request the server answered
// with an error status (its message names the route, status and request ID).
export const clientErrorSourceSchema = z.enum(['boundary', 'error', 'unhandledrejection', 'api'])

export const CLIENT_ERROR_MESSAGE_MAX = 500
export const CLIENT_ERROR_STACK_MAX = 4000

// One client error as the device records it (Diagnostics, M1-11) and later
// sends it (POST /api/client-errors, M2-08). Only the error itself, the path
// without its query string, the release and the time: never form values,
// tokens or request bodies.
export const clientErrorSchema = z.object({
  source: clientErrorSourceSchema,
  message: z.string().max(CLIENT_ERROR_MESSAGE_MAX),
  stack: z.string().max(CLIENT_ERROR_STACK_MAX).nullable(),
  route: z.string().startsWith('/'),
  release: z.string().min(1),
  at: instantSchema,
})

export type ClientError = z.infer<typeof clientErrorSchema>
export type ClientErrorSource = z.infer<typeof clientErrorSourceSchema>

// POST /api/client-errors (M2-08): a signed-in device sends the errors it
// recorded since its last report, at most this many per request; the server logs
// each one. The byte cap covers the largest valid request with room for JSON.
export const CLIENT_ERROR_REPORT_MAX = 20
export const CLIENT_ERROR_REPORT_BYTES_MAX = 128 * 1024

export const clientErrorReportSchema = z.object({
  errors: z.array(clientErrorSchema).min(1).max(CLIENT_ERROR_REPORT_MAX),
})

export const clientErrorReportResponseSchema = z.object({ received: z.int().min(0) })

export type ClientErrorReport = z.infer<typeof clientErrorReportSchema>
