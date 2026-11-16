import { Hono } from 'hono'

import type { AppEnv } from '../context.ts'

// Public liveness check: the API answers. It never touches the database, so
// anyone calling it cannot keep the Neon compute awake (database-check.ts).
export function healthRoutes() {
  return new Hono<AppEnv>().get('/', (c) => c.json({ status: 'ok' }))
}
