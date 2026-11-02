// Local development server. In AWS the same app runs on Lambda (M0-08).
import { serve } from '@hono/node-server'

import { app } from './app.ts'

const port = 8787

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(`API listening on http://localhost:${String(info.port)}/api/health\n`)
})
