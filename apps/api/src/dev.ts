// Local development server. In AWS the same app runs on Lambda (M0-08).
import { serve } from '@hono/node-server'

import { createApp } from './app.ts'
import { createPool, pingDatabase } from './db/client.ts'
import { parseEnv } from './env.ts'

const port = 8787

const env = parseEnv(process.env)
const pool = createPool(env.DATABASE_URL)
const app = createApp({ pingDatabase: () => pingDatabase(pool) })

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(`API listening on http://localhost:${String(info.port)}/api/health\n`)
})
