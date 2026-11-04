import { randomUUID } from 'node:crypto'

import type { ApiError } from '@gainframe/shared'
import { Hono } from 'hono'
import { routePath } from 'hono/route'

import type { AppEnv } from './context.ts'
import { errorFields, type Logger } from './log.ts'
import { type HealthDeps, healthRoutes } from './routes/health.ts'

export interface AppDeps extends HealthDeps {
  log: Logger
}

function errorBody(code: ApiError['error']['code'], message: string, requestId: string): ApiError {
  return { error: { code, message, requestId } }
}

// The Lambda request ID also tags the runtime's own START/END/REPORT lines.
// `bindings` is undefined when tests call `app.request()` without bindings.
function lambdaRequestId(bindings: AppEnv['Bindings'] | undefined): string | undefined {
  return bindings?.lambdaContext?.awsRequestId
}

// Dependencies are passed in so tests can run without a database and capture log lines.
export function createApp({ log, ...deps }: AppDeps) {
  const app = new Hono<AppEnv>()

  // Request ID and access log. Registered first, so it wraps every route,
  // the not-found handler and the error handler.
  app.use(async (c, next) => {
    const start = performance.now()
    const requestId = lambdaRequestId(c.env) ?? randomUUID()
    const requestLog = log.child({ requestId })
    c.set('requestId', requestId)
    c.set('log', requestLog)
    const ownRoute = routePath(c)

    await next()

    c.header('x-request-id', requestId)
    // The route pattern, never the path or query string, which can hold IDs or personal data.
    const route = routePath(c, -1)
    requestLog.info('request', {
      method: c.req.method,
      route: route === ownRoute ? null : route,
      status: c.res.status,
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
  app.route('/api/health', healthRoutes(deps))

  return app
}
