import { eq } from 'drizzle-orm'

import type { Database } from '../db/client.ts'
import { syncedTables, syncState } from '../db/schema.ts'

// Removes every row of one user, in one transaction: account deletion (M2-10)
// erases, so rows are deleted rather than soft-deleted. The user's sync state is
// locked first, as a push locks it, so a push in flight finishes before the
// delete or starts after it. Returns the rows removed per table, for the log.
export async function deleteUserRows(
  db: Database,
  userId: string,
): Promise<Record<string, number>> {
  return db.transaction(async (tx) => {
    await tx.select().from(syncState).where(eq(syncState.userId, userId)).for('update')
    const removed: Record<string, number> = {}
    for (const [name, table] of Object.entries(syncedTables)) {
      const deleted = await tx
        .delete(table)
        .where(eq(table.userId, userId))
        .returning({ id: table.id })
      removed[name] = deleted.length
    }
    await tx.delete(syncState).where(eq(syncState.userId, userId))
    return removed
  })
}
