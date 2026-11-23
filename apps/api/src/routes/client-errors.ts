import {
  CLIENT_ERROR_REPORT_BYTES_MAX,
  type ClientError,
  clientErrorReportSchema,
} from '@gainframe/shared'
import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import type { AppEnv } from '../context.ts'
import { errorBody } from '../error-body.ts'

// A crash on the device is logged as an error, so it reaches the alarm. A failed
// request (`api`) is a warning: the server logged its own side of it already,
// and a device that was offline reports many.
function level(error: ClientError): 'warn' | 'error' {
  return error.source === 'api' ? 'warn' : 'error'
}

// POST /api/client-errors (M2-08): the Diagnostics entries a signed-in device
// recorded since its last report, one log line each with `source: web`. The
// user comes from the token (requireUser), never from the body.
export function clientErrorRoutes() {
  return new Hono<AppEnv>().post(
    '/',
    bodyLimit({
      maxSize: CLIENT_ERROR_REPORT_BYTES_MAX,
      onError: (c: Context<AppEnv>) =>
        c.json(errorBody('invalid_request', 'Report too large', c.var.requestId), 413),
    }),
    async (c) => {
      const report = clientErrorReportSchema.safeParse(await c.req.json().catch(() => undefined))
      if (!report.success) {
        return c.json(errorBody('invalid_request', 'Invalid error report', c.var.requestId), 400)
      }
      const log = c.var.log.child({ source: 'web', userId: c.var.userId ?? null })
      for (const error of report.data.errors) {
        log[level(error)]('client error', {
          clientSource: error.source,
          errorMessage: error.message,
          stack: error.stack,
          clientRoute: error.route,
          clientRelease: error.release,
          at: error.at,
        })
      }
      return c.json({ received: report.data.errors.length })
    },
  )
}
