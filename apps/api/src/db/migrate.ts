import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

// The longest a single API query may run. Below the Lambda timeout (10 s), so a
// stuck query fails with a logged error instead of the function timing out.
export const STATEMENT_TIMEOUT_MS = 8000

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

// Neon's pooled endpoint is the direct one with `-pooler` added to the endpoint
// ID, and Neon recommends the direct connection for schema migrations
// (https://neon.com/docs/connect/connection-pooling). Other hosts are unchanged.
export function directConnectionUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl)
  const [endpoint, ...domain] = url.hostname.split('.')
  if (endpoint?.endsWith('-pooler') === true) {
    url.hostname = [endpoint.slice(0, -'-pooler'.length), ...domain].join('.')
  }
  return url.toString()
}

// Applies the pending migrations, then sets the API role's statement timeout.
// The API connects through Neon's PgBouncer in transaction mode, where a
// session `SET` leaks to other clients and a startup parameter is not
// documented to pass; a role default applies to every new server connection.
export async function runMigrations(databaseUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: directConnectionUrl(databaseUrl) })
  await client.connect()
  try {
    // A migration may legitimately run longer than an API query.
    await client.query('SET statement_timeout = 0')
    await migrate(drizzle({ client }), { migrationsFolder })
    await client.query(
      `ALTER ROLE CURRENT_USER SET statement_timeout = ${String(STATEMENT_TIMEOUT_MS)}`,
    )
  } finally {
    await client.end()
  }
}
