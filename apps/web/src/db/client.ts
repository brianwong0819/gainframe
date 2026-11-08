import { createRepositories } from './repositories'
import { GainframeDb } from './schema'

// The app's one database connection. Dexie opens it on first use, so importing
// this module during the static export build does not touch IndexedDB.
export const db = new GainframeDb()
export const repositories = createRepositories(db)
