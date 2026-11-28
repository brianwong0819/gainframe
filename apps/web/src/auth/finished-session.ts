// A session whose code exchange finished but which is not yet in IndexedDB.
// After the redirect back from Google, WebKit on the iPhone can leave every
// IndexedDB transaction of the page pending (WebKit bugs 324058 and 315804),
// so the sign-in page keeps the session here, reloads, and stores it from a
// fresh page. It stays only until stored: the same tokens then live in
// IndexedDB, which the same scripts can read.
import { z } from 'zod'

import { authSessionSchema } from './session'

const finishedKey = 'gainframe.sign-in.finished'

// Older than a sign-in may take, the stash is from an abandoned attempt.
const FINISHED_MAX_AGE_MS = 10 * 60 * 1000

// `reloadedAt`: set when the page reloaded because storing hung, so the next
// page stores without another reload and records how long the first one hung.
const finishedSchema = z.object({
  session: authSessionSchema,
  savedAt: z.number(),
  reloadedAt: z.number().nullable(),
})
export type FinishedSession = z.infer<typeof finishedSchema>

// False when storage is unavailable: the page then cannot reload safely and
// waits for IndexedDB instead.
export function stashFinished(finished: FinishedSession): boolean {
  try {
    localStorage.setItem(finishedKey, JSON.stringify(finished))
    return true
  } catch {
    return false
  }
}

export function readFinished(now: number): FinishedSession | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(finishedKey)
  } catch {
    return null
  }
  if (raw === null) return null
  try {
    const result = finishedSchema.safeParse(JSON.parse(raw))
    if (result.success && now - result.data.savedAt <= FINISHED_MAX_AGE_MS) return result.data
  } catch {
    // Unreadable: removed below.
  }
  clearFinished()
  return null
}

export function clearFinished(): void {
  try {
    localStorage.removeItem(finishedKey)
  } catch {
    // Nothing stored.
  }
}
