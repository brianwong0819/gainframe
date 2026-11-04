import { afterAll, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { parseEnv } from '../env.ts'
import { createLogger } from '../log.ts'
import { createPool, pingDatabase } from './client.ts'

const log = createLogger({ release: 'test', write: () => undefined })
const pool = createPool(parseEnv(process.env).DATABASE_URL, log)

afterAll(async () => {
  await pool.end()
})

describe('database client (real Postgres)', () => {
  it('answers a ping', async () => {
    await expect(pingDatabase(pool)).resolves.toBeUndefined()
  })

  it('lets GET /api/health report the database as connected', async () => {
    const app = createApp({ log, pingDatabase: () => pingDatabase(pool) })
    const res = await app.request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', database: 'connected' })
  })
})
