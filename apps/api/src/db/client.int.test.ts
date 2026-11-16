import { afterAll, describe, expect, it } from 'vitest'

import { checkDatabase } from '../database-check.ts'
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

  it('lets the database check report it as connected', async () => {
    await expect(checkDatabase(() => pingDatabase(pool), log)).resolves.toEqual({
      database: 'connected',
    })
  })
})
