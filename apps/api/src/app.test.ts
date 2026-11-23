import { apiErrorSchema, TOKEN_HEADER } from '@gainframe/shared'
import type { MiddlewareHandler } from 'hono'
import { drizzle } from 'drizzle-orm/node-postgres'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createApp } from './app.ts'
import type { AppEnv } from './context.ts'
import { errorBody } from './error-body.ts'
import { createLogger } from './log.ts'

const signedIn = { headers: { [TOKEN_HEADER]: 'Bearer test-token' } }

const lineSchema = z.record(z.string(), z.unknown())

function setup() {
  const lines: string[] = []
  const log = createLogger({ release: 'test-sha', write: (line) => lines.push(line) })
  // Stands in for auth.ts, tested on its own: a request with the test token is user-a.
  const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (c.req.header(TOKEN_HEADER) !== 'Bearer test-token') {
      return c.json(errorBody('unauthorized', 'Sign-in required', c.var.requestId), 401)
    }
    c.set('userId', 'user-a')
    return next()
  }
  // No route here reaches the database.
  const app = createApp({
    log,
    requireUser,
    db: drizzle.mock(),
    deleteIdentity: () => Promise.resolve(),
    generate: () => Promise.reject(new Error('no AI route here')),
  })
  const logs = () => lines.map((line) => lineSchema.parse(JSON.parse(line)))
  return { app, lines, logs }
}

describe('GET /api/health', () => {
  it('answers without touching the database, so public calls cannot keep it awake', async () => {
    const { app } = setup()
    const res = await app.request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('request ID and access log', () => {
  it('returns a generated request ID and logs one access line with it', async () => {
    const { app, logs } = setup()
    const res = await app.request('/api/health')

    const requestId = res.headers.get('x-request-id')
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
    const [line, ...rest] = logs()
    expect(rest).toEqual([])
    expect(line).toMatchObject({
      level: 'info',
      msg: 'request',
      method: 'GET',
      route: '/api/health',
      status: 200,
      requestId,
      release: 'test-sha',
    })
    expect(typeof line?.durationMs).toBe('number')
  })

  it('uses the Lambda request ID when the function runs in AWS', async () => {
    const { app, logs } = setup()
    const res = await app.request(
      '/api/health',
      {},
      { lambdaContext: { awsRequestId: 'lambda-1' } },
    )

    expect(res.headers.get('x-request-id')).toBe('lambda-1')
    expect(logs()[0]).toMatchObject({ requestId: 'lambda-1' })
  })

  it('never logs headers or the query string', async () => {
    const { app, lines } = setup()
    await app.request('/api/health?email=someone%40example.com', {
      headers: {
        authorization: 'Bearer secret-authorization-value',
        'x-gainframe-token': 'secret-token-value',
      },
    })

    const output = lines.join('')
    expect(output).not.toContain('secret-authorization-value')
    expect(output).not.toContain('secret-token-value')
    expect(output).not.toContain('someone')
  })
})

describe('error responses', () => {
  it('returns 404 in the shared error shape for an unknown route', async () => {
    const { app, logs } = setup()
    const res = await app.request('/api/unknown', signedIn)

    expect(res.status).toBe(404)
    const body = apiErrorSchema.parse(await res.json())
    expect(body.error).toEqual({
      code: 'not_found',
      message: 'Not found',
      requestId: res.headers.get('x-request-id'),
    })
    expect(logs()).toEqual([
      expect.objectContaining({ msg: 'request', route: null, status: 404, userId: 'user-a' }),
    ])
  })

  it('returns 500 in the shared error shape and logs the unexpected error once with its stack', async () => {
    const { app, logs } = setup()
    app.get('/api/throws', () => {
      throw new Error('internal detail')
    })

    const res = await app.request('/api/throws', signedIn)

    expect(res.status).toBe(500)
    const body = apiErrorSchema.parse(await res.json())
    const requestId = res.headers.get('x-request-id')
    expect(body.error).toEqual({
      code: 'internal_error',
      message: 'Internal server error',
      requestId,
    })
    const errors = logs().filter((line) => line.level === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      msg: 'unhandled error',
      errorMessage: 'internal detail',
      requestId,
      release: 'test-sha',
    })
    expect(errors[0]?.stack).toContain('internal detail')
    expect(logs()).toContainEqual(
      expect.objectContaining({ msg: 'request', route: '/api/throws', status: 500 }),
    )
  })
})

describe('signed-in routes', () => {
  it('answers 401 without a token, also for a route that does not exist', async () => {
    const { app, logs } = setup()
    const res = await app.request('/api/anything')

    expect(res.status).toBe(401)
    expect(apiErrorSchema.parse(await res.json()).error.code).toBe('unauthorized')
    expect(logs()[0]).toMatchObject({ msg: 'request', status: 401, userId: null })
  })

  it("logs the verified user's ID on the access line", async () => {
    const { app, logs } = setup()
    const res = await app.request('/api/anything', {
      headers: { [TOKEN_HEADER]: 'Bearer test-token' },
    })

    expect(res.status).toBe(404)
    expect(logs()[0]).toMatchObject({ msg: 'request', status: 404, userId: 'user-a' })
  })
})
