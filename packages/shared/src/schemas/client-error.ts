import { z } from 'zod'

import { instantSchema } from './row.ts'

// Where a client error was caught: a React error boundary, the window `error`
// event, or an unhandled promise rejection.
export const clientErrorSourceSchema = z.enum(['boundary', 'error', 'unhandledrejection'])

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
