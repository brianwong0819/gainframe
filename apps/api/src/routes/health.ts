import { Hono } from 'hono'

import type { AppEnv } from '../context.ts'
import { errorFields } from '../log.ts'

export interface HealthDeps {
  pingDatabase: () => Promise<void>
}

export function healthRoutes({ pingDatabase }: HealthDeps) {
  return new Hono<AppEnv>().get('/', async (c) => {
    try {
      await pingDatabase()
      return c.json({ status: 'ok', database: 'connected' })
    } catch (error) {
      c.var.log.error('database health check failed', errorFields(error))
      return c.json({ status: 'error', database: 'unreachable' }, 503)
    }
  })
}
