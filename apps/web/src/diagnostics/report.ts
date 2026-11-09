import type { ClientErrorSource } from '@gainframe/shared'

import { db } from '../db/client'
import { release } from '../release'

import { describeError, recordError } from './error-log'

/**
 * Records an error caught on this device, for Diagnostics (M1-11). The route
 * is the path only: a query string could carry user input.
 */
export function reportError(source: ClientErrorSource, reason: unknown): void {
  recordError(db, {
    source,
    ...describeError(reason),
    route: window.location.pathname,
    release,
    at: new Date().toISOString(),
  }).catch(() => {
    // Recording failed (storage full or blocked). Nothing else can show the
    // error, and reporting this failure could loop, so it is dropped.
  })
}
