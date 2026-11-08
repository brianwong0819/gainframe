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
