import { pushRequestSchema, type PushResponse, SYNC_VERSION_HEADER } from '@gainframe/shared'
import { type Context, Hono, type MiddlewareHandler } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../context.ts'
import type { Database } from '../db/client.ts'
import { errorBody } from '../error-body.ts'
import { pullRows } from '../sync/pull.ts'
import { pushRows } from '../sync/push.ts'

// The oldest sync version this server accepts (ADR-0003). Raise it only when a
// change cannot be read by older apps; they then show "update the app".
// Versions 2 and 3 (M3-01, M3-02) added tables an older app fails to parse in
// a pull.
const MIN_SYNC_VERSION = 4

// Distinct rejection paths kept in a push log line, enough to spot a pattern.
const LOGGED_ISSUES_MAX = 20

const versionSchema = z
  .string()
  .regex(/^\d{1,6}$/)
  .transform(Number)
const cursorSchema = z
  .string()
  .regex(/^\d{1,15}$/)
  .transform(Number)
  .default(0)

const requireSyncVersion: MiddlewareHandler<AppEnv> = async (c, next) => {
  const version = versionSchema.safeParse(c.req.header(SYNC_VERSION_HEADER))
  if (!version.success || version.data < MIN_SYNC_VERSION) {
    return c.json(errorBody('update_required', 'Update the app to sync', c.var.requestId), 426)
  }
  return next()
}

function signedInUser(c: Context<AppEnv>): string {
  const { userId } = c.var
  if (userId === undefined) throw new Error('sync route reached without requireUser')
  return userId
}

function invalidRequest(c: Context<AppEnv>, error: z.ZodError) {
  c.var.log.warn('invalid sync request', {
    issues: error.issues
      .slice(0, LOGGED_ISSUES_MAX)
      .map((issue) => issue.path.join('.'))
      .join(', '),
  })
  return c.json(errorBody('invalid_request', 'Invalid sync request', c.var.requestId), 400)
}

export function syncRoutes(db: Database, now: () => Date = () => new Date()) {
  return new Hono<AppEnv>()
    .use(requireSyncVersion)
    .post('/push', async (c) => {
      const request = pushRequestSchema.safeParse(await c.req.json().catch(() => undefined))
      if (!request.success) return invalidRequest(c, request.error)
      const { rows } = request.data
      const results = await pushRows(db, signedInUser(c), rows, now())

      // Counts and issue paths only: row contents are personal data.
      const count = (status: string) => results.filter((result) => result.status === status).length
      const issues = new Set<string>()
      results.forEach((result, index) => {
        if (result.status !== 'rejected') return
        for (const path of result.issues)
          issues.add(`${rows[index]?.table ?? ''}.${path} ${result.reason}`)
      })
      c.var.log.info('sync push', {
        received: rows.length,
        applied: count('applied'),
        ignored: count('ignored'),
        rejected: count('rejected'),
        rejectedIssues: [...issues].slice(0, LOGGED_ISSUES_MAX).join(', '),
      })
      return c.json({ results } satisfies PushResponse)
    })
    .get('/pull', async (c) => {
      const cursor = cursorSchema.safeParse(c.req.query('cursor'))
      if (!cursor.success) return invalidRequest(c, cursor.error)
      return c.json(await pullRows(db, signedInUser(c), cursor.data))
    })
}
