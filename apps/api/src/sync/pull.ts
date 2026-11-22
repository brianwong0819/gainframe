// Pull (ADR-0003): the user's rows with `server_version` above the cursor, in
// version order. All tables are read in one repeatable-read snapshot: separate
// snapshots could include a row from a push that committed between two reads
// while missing an earlier row of the same push, and the cursor would skip it.
import { type PullResponse, syncConfig, syncedTableNameSchema } from '@gainframe/shared'
import { and, asc, eq, gt } from 'drizzle-orm'

import type { Database } from '../db/client.ts'
import { syncedTables } from '../db/schema.ts'

export async function pullRows(
  db: Database,
  userId: string,
  cursor: number,
  limit: number = syncConfig.pullPageMax,
): Promise<PullResponse> {
  const changed = await db.transaction(
    async (tx) => {
      const pages = []
      for (const table of syncedTableNameSchema.options) {
        const columns = syncedTables[table]
        const rows = await tx
          .select()
          .from(columns)
          .where(and(eq(columns.userId, userId), gt(columns.serverVersion, cursor)))
          .orderBy(asc(columns.serverVersion))
          .limit(limit + 1)
        pages.push(...rows.map(({ serverVersion, ...row }) => ({ table, serverVersion, row })))
      }
      return pages
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
  // Each table's page holds its lowest versions, so the lowest `limit` of all
  // pages are the next `limit` changes overall.
  const page = changed.sort((a, b) => a.serverVersion - b.serverVersion).slice(0, limit)
  return {
    rows: page.map(({ table, row }) => ({ table, row })),
    cursor: page.at(-1)?.serverVersion ?? cursor,
    more: changed.length > limit,
  }
}
