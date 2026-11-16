import { z } from 'zod'

import { errorFields, type Logger } from './log.ts'

// The database check runs only when the function is invoked directly
// (`aws lambda invoke`), which needs `lambda:InvokeFunction`; CloudFront and
// the function URL can never send this event. The deploy smoke test uses it.
export const databaseCheckEventSchema = z.strictObject({ check: z.literal('database') })
export type DatabaseCheckEvent = z.infer<typeof databaseCheckEventSchema>

export const isDatabaseCheckEvent = (event: unknown): event is DatabaseCheckEvent =>
  databaseCheckEventSchema.safeParse(event).success

export interface DatabaseCheckResult {
  database: 'connected' | 'unreachable'
}

/** Pings the database once; a failure is logged once and reported, never thrown. */
export async function checkDatabase(
  pingDatabase: () => Promise<void>,
  log: Logger,
): Promise<DatabaseCheckResult> {
  try {
    await pingDatabase()
    log.info('database check', { database: 'connected' })
    return { database: 'connected' }
  } catch (error) {
    log.error('database check failed', errorFields(error))
    return { database: 'unreachable' }
  }
}
