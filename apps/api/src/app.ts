import { randomUUID } from 'node:crypto'

import { Hono, type MiddlewareHandler } from 'hono'
import { matchedRoutes } from 'hono/route'

import type { AppEnv } from './context.ts'
import type { Database } from './db/client.ts'
import { errorBody } from './error-body.ts'
import { errorFields, type Logger } from './log.ts'
import { accountRoutes, type DeleteIdentity } from './routes/account.ts'
import { clientErrorRoutes } from './routes/client-errors.ts'
import { healthRoutes } from './routes/health.ts'
import { syncRoutes } from './routes/sync.ts'

export interface AppDeps {
  log: Logger
  // Verifies the caller's token and sets `userId` (auth.ts `requireUser`).
  requireUser: MiddlewareHandler<AppEnv>
  db: Database
  deleteIdentity: DeleteIdentity
  // The server clock for the push clock-skew check; tests fix it.
  now?: () => Date
}

// The Lambda request ID also tags the runtime's own START/END/REPORT lines.
// `bindings` is undefined when tests call `app.request()` without bindings.
function lambdaRequestId(bindings: AppEnv['Bindings'] | undefined): string | undefined {
  return bindings?.lambdaContext?.awsRequestId
}

// Dependencies are passed in so tests can run without a database and capture log lines.
export function createApp({ log, requireUser, db, deleteIdentity, now }: AppDeps) {
  const app = new Hono<AppEnv>()

  // Request ID and access log. Registered first, so it wraps every route,
  // the not-found handler and the error handler.
  app.use(async (c, next) => {
    const start = performance.now()
    const requestId = lambdaRequestId(c.env) ?? randomUUID()
    const requestLog = log.child({ requestId })
    c.set('requestId', requestId)
    c.set('log', requestLog)
    await next()

    c.header('x-request-id', requestId)
    // The route pattern, never the path or query string, which can hold IDs or
    // personal data. Middleware (`use`, method ALL) is skipped, so a request that
    // matched no route logs null.
    const route = matchedRoutes(c).findLast((match) => match.method !== 'ALL')?.path ?? null
    requestLog.info('request', {
      method: c.req.method,
      route,
      status: c.res.status,
      // The Cognito `sub` once a route has verified the token; never the email.
      userId: c.var.userId ?? null,
      durationMs: Math.round(performance.now() - start),
    })
  })

  app.notFound((c) => c.json(errorBody('not_found', 'Not found', c.var.requestId), 404))

  // The one place an unexpected error is logged. The response never carries
  // the error message, which can contain internal details.
  app.onError((error, c) => {
    c.var.log.error('unhandled error', errorFields(error))
    return c.json(errorBody('internal_error', 'Internal server error', c.var.requestId), 500)
  })

  // CloudFront forwards `/api/*` to the Lambda without stripping the prefix,
  // so every route is mounted under `/api`.
  app.route('/api/health', healthRoutes())

  // Every other route needs a signed-in user; an unknown route without a token
  // gets 401 rather than 404, so the API's shape is not visible to strangers.
  app.use('/api/*', requireUser)
  app.route('/api/sync', syncRoutes(db, now))
  app.route('/api/account', accountRoutes(db, deleteIdentity, now))
  app.route('/api/client-errors', clientErrorRoutes())

  return app
}
