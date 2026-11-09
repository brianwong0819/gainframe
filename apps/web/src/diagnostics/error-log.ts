import {
  CLIENT_ERROR_MESSAGE_MAX,
  CLIENT_ERROR_STACK_MAX,
  type ClientError,
  clientErrorSchema,
} from '@gainframe/shared'

import type { GainframeDb } from '../db/schema'

// Diagnostics keeps the most recent errors only; older ones are dropped.
export const ERROR_LOG_CAP = 200

/** The message and stack of anything thrown, cut to the stored lengths. */
export function describeError(reason: unknown): Pick<ClientError, 'message' | 'stack'> {
  if (reason instanceof Error) {
    return {
      message: (reason.message || reason.name).slice(0, CLIENT_ERROR_MESSAGE_MAX),
      stack: reason.stack?.slice(0, CLIENT_ERROR_STACK_MAX) ?? null,
    }
  }
  return { message: String(reason).slice(0, CLIENT_ERROR_MESSAGE_MAX), stack: null }
}

/** Stores one error and drops the oldest beyond the cap, in one transaction. */
export async function recordError(
  db: GainframeDb,
  error: ClientError,
  cap = ERROR_LOG_CAP,
): Promise<void> {
  const entry = clientErrorSchema.parse(error)
  await db.transaction('rw', db.errors, async () => {
    await db.errors.add(entry)
    const excess = (await db.errors.count()) - cap
    if (excess > 0) await db.errors.orderBy('seq').limit(excess).delete()
  })
}

/** The recorded errors, newest first. */
export function recentErrors(db: GainframeDb) {
  return db.errors.orderBy('seq').reverse().toArray()
}
