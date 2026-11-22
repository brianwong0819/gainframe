import { type AuthSession, authSessionSchema } from '../auth/session'

import type { GainframeDb } from './schema'

const KEY = 'authSession'

// The session as stored, or null when signed out or when the stored value no
// longer matches the schema (then the user signs in again).
export async function loadSession(db: GainframeDb): Promise<AuthSession | null> {
  const setting = await db.settings.get(KEY)
  if (setting === undefined) return null
  try {
    const result = authSessionSchema.safeParse(JSON.parse(setting.value))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export async function saveSession(db: GainframeDb, session: AuthSession): Promise<void> {
  await db.settings.put({ key: KEY, value: JSON.stringify(authSessionSchema.parse(session)) })
}
