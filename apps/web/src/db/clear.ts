import type { GainframeDb } from './schema'

/**
 * Empties every table on this device in one transaction: data, device settings,
 * the outbox and the error log. The schema stays, so the app reopens on the
 * same database version as a first launch would leave it. With `keepSession`
 * a signed-in device stays signed in: the sync cursor goes with the rest, so
 * the next sync downloads the account's records again.
 */
export async function clearAllData(
  db: GainframeDb,
  { keepSession = false }: { keepSession?: boolean } = {},
): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const session = keepSession ? await db.settings.get('authSession') : undefined
    await Promise.all(db.tables.map((table) => table.clear()))
    if (session !== undefined) await db.settings.put(session)
  })
}
