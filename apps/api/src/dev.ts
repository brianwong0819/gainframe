// Local development server. In AWS the same app runs on Lambda (M0-08).
import { serve } from '@hono/node-server'

import { createApp } from './app.ts'
import { createKeyCache, fetchJwks, requireUser } from './auth.ts'
import { checkDatabase } from './database-check.ts'
import { createDatabase, createPool, pingDatabase } from './db/client.ts'
import { parseEnv, readRelease } from './env.ts'
import { createLogger } from './log.ts'

const port = 8787

const log = createLogger({ release: readRelease(process.env) })
const env = parseEnv(process.env)
const pool = createPool(env.DATABASE_URL, log)
const auth = { issuer: env.AUTH_ISSUER, clientId: env.AUTH_CLIENT_ID }
const app = createApp({
  log,
  requireUser: requireUser(auth, createKeyCache(fetchJwks(auth.issuer))),
  db: createDatabase(pool),
})

serve({ fetch: app.fetch, port }, (info) => {
  log.info('api listening', { url: `http://localhost:${String(info.port)}/api/health` })
  void checkDatabase(() => pingDatabase(pool), log)
})
