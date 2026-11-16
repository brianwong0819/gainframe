// Asks the browser not to evict the database under storage pressure. Data lives
// only on the device until sync (M2), and Safari may otherwise clear it. Called
// on every launch until granted; once granted it returns at once.
export async function requestPersistentStorage(
  storage: Pick<StorageManager, 'persist' | 'persisted'> | undefined,
): Promise<boolean> {
  if (storage === undefined) return false
  if (await storage.persisted()) return true
  return storage.persist()
}

/** Whether storage is persistent, for Diagnostics; null when the browser cannot say. */
export async function readPersisted(
  storage: Pick<StorageManager, 'persisted'> | undefined,
): Promise<boolean | null> {
  if (storage === undefined) return null
  try {
    return await storage.persisted()
  } catch {
    // Some browsers reject in private mode; the answer is then unknown.
    return null
  }
}
