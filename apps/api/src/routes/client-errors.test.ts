import { CLIENT_ERROR_REPORT_MAX, type ClientError, TOKEN_HEADER } from '@gainframe/shared'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { MiddlewareHandler } from 'hono'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createApp } from '../app.ts'
import type { AppEnv } from '../context.ts'
import { errorBody } from '../error-body.ts'
import { createLogger } from '../log.ts'

const lineSchema = z.record(z.string(), z.unknown())

function setup() {
  const lines: string[] = []
  const log = createLogger({ release: 'test-sha', write: (line) => lines.push(line) })
  // Stands in for auth.ts: each test token is one user.
  const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
    const user = { 'Bearer token-a': 'user-a', 'Bearer token-b': 'user-b' }[
      c.req.header(TOKEN_HEADER) ?? ''
    ]
    if (user === undefined) {
      return c.json(errorBody('unauthorized', 'Sign-in required', c.var.requestId), 401)
    }
    c.set('userId', user)
    return next()
  }
  const app = createApp({
    log,
    requireUser,
    db: drizzle.mock(),
    deleteIdentity: () => Promise.resolve(),
    generate: () => Promise.reject(new Error('no AI route here')),
  })
  const logs = () => lines.map((line) => lineSchema.parse(JSON.parse(line)))
  return { app, logs }
}

const crash: ClientError = {
  source: 'boundary',
  message: 'Cannot read properties of undefined',
  stack: 'TypeError: Cannot read properties of undefined\n    at Summary',
  route: '/workout/summary',
  release: 'web-sha',
  at: '2026-11-23T06:00:00.000Z',
}
const failedRequest: ClientError = {
  ...crash,
  source: 'api',
  message: 'POST /api/sync/push answered 503 (request r-1)',
  stack: null,
}

function post(app: ReturnType<typeof setup>['app'], body: unknown, token = 'Bearer token-a') {
  return app.request('/api/client-errors', {
    method: 'POST',
    headers: { [TOKEN_HEADER]: token, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/client-errors', () => {
  it('logs each entry as source web: a crash as an error, a failed request as a warning', async () => {
    const { app, logs } = setup()
    const res = await post(app, { errors: [crash, failedRequest] })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: 2 })
    const reported = logs().filter((line) => line.msg === 'client error')
    expect(reported).toEqual([
      expect.objectContaining({
        level: 'error',
        source: 'web',
        userId: 'user-a',
        clientSource: 'boundary',
        errorMessage: crash.message,
        stack: crash.stack,
        clientRoute: '/workout/summary',
        clientRelease: 'web-sha',
      }),
      expect.objectContaining({ level: 'warn', source: 'web', clientSource: 'api' }),
    ])
    expect(logs().at(-1)).toMatchObject({ msg: 'request', route: '/api/client-errors' })
  })

  it('logs the user of the token, never a user named in the body', async () => {
    const { app, logs } = setup()
    await post(
      app,
      { errors: [{ ...crash, userId: 'user-a' }], userId: 'user-a' },
      'Bearer token-b',
    )

    const reported = logs().filter((line) => line.msg === 'client error')
    expect(reported.map((line) => line.userId)).toEqual(['user-b'])
  })

  it('requires a signed-in user', async () => {
    const { app, logs } = setup()
    const res = await post(app, { errors: [crash] }, 'Bearer unknown')

    expect(res.status).toBe(401)
    expect(logs().filter((line) => line.msg === 'client error')).toEqual([])
  })

  it('refuses an empty, invalid or oversized report without logging it', async () => {
    const { app, logs } = setup()
    const tooMany = Array.from({ length: CLIENT_ERROR_REPORT_MAX + 1 }, () => crash)
    const statuses = await Promise.all(
      [
        { errors: [] },
        { errors: [{ ...crash, route: 'https://example.com/x' }] },
        { errors: tooMany },
        { errors: [{ ...crash, message: 'x'.repeat(200 * 1024) }] },
      ].map(async (body) => (await post(app, body)).status),
    )

    expect(statuses).toEqual([400, 400, 400, 413])
    expect(logs().filter((line) => line.msg === 'client error')).toEqual([])
  })
})
