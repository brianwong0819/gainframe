import pg from 'pg'

// Fail fast when the database is down instead of waiting for the OS TCP timeout.
const CONNECTION_TIMEOUT_MS = 2000

export function createPool(databaseUrl: string): pg.Pool {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  })
  // An idle pooled client can fail, e.g. when the database restarts. Without a
  // listener Node treats the emitted 'error' as fatal and the process exits.
  pool.on('error', (error) => {
    process.stderr.write(
      `${JSON.stringify({ level: 'error', msg: 'idle database client failed', error: error.message })}\n`,
    )
  })
  return pool
}

export async function pingDatabase(pool: pg.Pool): Promise<void> {
  await pool.query('select 1')
}
