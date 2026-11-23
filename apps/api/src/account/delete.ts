import { eq } from 'drizzle-orm'

import type { Database } from '../db/client.ts'
import { aiUsage, deletedUsers, syncedTables, syncState } from '../db/schema.ts'

// Removes every row of one user (synced tables, sync state, AI usage), in one transaction: account deletion (M2-10)
// erases, so rows are deleted rather than soft-deleted. The user's sync state is
// locked first, as a push locks it, so a push in flight finishes before the
// delete or starts after it, and a push after it finds the user in
// `deleted_users` and is refused. Returns the rows removed per table, for the log.
export async function deleteUserRows(
  db: Database,
  userId: string,
  now: Date,
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
    await tx.delete(aiUsage).where(eq(aiUsage.userId, userId))
    await tx
      .insert(deletedUsers)
      .values({ userId, deletedAt: now.toISOString() })
      .onConflictDoNothing()
    return removed
  })
}
