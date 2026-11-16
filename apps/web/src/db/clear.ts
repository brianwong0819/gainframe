import type { GainframeDb } from './schema'

/**
 * Empties every table on this device in one transaction: data, device settings,
 * the outbox and the error log. The schema stays, so the app reopens on the
 * same database version as a first launch would leave it.
 */
export async function clearAllData(db: GainframeDb): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
  })
}
