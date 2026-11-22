import { afterAll, describe, expect, it } from 'vitest'

import { checkDatabase } from '../database-check.ts'
import { parseDatabaseUrl } from '../env.ts'
import { createLogger } from '../log.ts'
import { createPool, pingDatabase } from './client.ts'

const log = createLogger({ release: 'test', write: () => undefined })
const pool = createPool(parseDatabaseUrl(process.env), log)

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
