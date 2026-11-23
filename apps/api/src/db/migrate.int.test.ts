import pg from 'pg'
import { afterAll, describe, expect, it } from 'vitest'

import { parseDatabaseUrl } from '../env.ts'
import { runMigrations, STATEMENT_TIMEOUT_MS } from './migrate.ts'

const DATABASE_URL = parseDatabaseUrl(process.env)
const pool = new pg.Pool({ connectionString: DATABASE_URL })

afterAll(async () => {
  await pool.end()
})

describe('migrations (real Postgres)', () => {
  it('create every table and can run again without changes', async () => {
    await runMigrations(DATABASE_URL)
    await runMigrations(DATABASE_URL)
    const { rows } = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by 1",
    )
    expect(rows.map((row) => row.table_name)).toEqual([
      'body_metrics',
      'exercises',
      'meal_items',
      'meals',
      'plan_days',
      'plan_items',
      'plans',
      'profiles',
      'sync_state',
      'workout_exercises',
      'workout_sets',
      'workouts',
    ])
  })

  it('give new connections the API statement timeout', async () => {
    await runMigrations(DATABASE_URL)
    const client = new pg.Client({ connectionString: DATABASE_URL })
    await client.connect()
    try {
      const { rows } = await client.query<{ statement_timeout: string }>('show statement_timeout')
      expect(rows[0]?.statement_timeout).toBe(`${String(STATEMENT_TIMEOUT_MS / 1000)}s`)
    } finally {
      await client.end()
    }
  })
})
