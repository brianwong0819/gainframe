// The app's one sync engine and what starts it: the app opening, a connection
// returning, the app coming back to the foreground, a sign-in, and each change
// written to the outbox (after a short delay, so a burst of sets goes in one
// push). Null in a build without sign-in. After each successful run the
// recorded errors go to the API too (diagnostics/error-reports.ts).
import { syncConfig } from '@gainframe/shared'
import { liveQuery } from 'dexie'

import { ApiRequestError, createApiClient, NotSignedInError } from '../api/client'
import { readAuthConfig } from '../auth/config'
import { db } from '../db/client'
import { readBackupState } from '../db/sync'
import { sendErrorReports } from '../diagnostics/error-reports'
import { reportError } from '../diagnostics/report'

import { createSyncEngine } from './engine'

const config = readAuthConfig()

// The one API client, null in a build without sign-in.
export const api =
  config === null
    ? null
    : createApiClient({
        db,
        config,
        onFailure: (message) => {
          reportError('api', message)
        },
      })

export const backup =
  api === null
    ? null
    : createSyncEngine({
        db,
        api,
        isOnline: () => navigator.onLine,
        onRejected: (rows) => {
          for (const { table, rowId, result } of rows) {
            reportError(
              'api',
              `sync push rejected ${table} ${rowId}: ${result.reason} ${result.issues.join(', ')}`,
            )
          }
        },
        onUnreadable: (rows) => {
          reportError(
            'api',
            `sync pull skipped ${String(rows.length)} rows that failed their schema`,
          )
        },
        onUnexpected: (error) => {
          reportError('api', error)
        },
      })

// Starts the triggers; returns a function that stops them.
export function startBackup(): () => void {
  const engine = backup
  if (engine === null || api === null) return () => undefined
  const run = () => void engine.run()
  const onVisible = () => {
    if (document.visibilityState === 'visible') run()
  }
  let pushTimer: ReturnType<typeof setTimeout> | undefined
  let last: { account: string; queued: number } | null = null
  // Fires once on subscribe, which is the run at launch. A token refresh also
  // rewrites the session and a push empties the outbox, so only a change of
  // account or expiry, or a new outbox entry, starts a run.
  const changes = liveQuery(async () => {
    const { session, queued } = await readBackupState(db)
    return {
      account: session === null ? '' : `${session.userId} ${String(session.expired)}`,
      queued,
    }
  }).subscribe((next) => {
    const accountChanged = last?.account !== next.account
    const added = last !== null && next.queued > last.queued
    last = next
    if (accountChanged) {
      clearTimeout(pushTimer)
      run()
    } else if (added) {
      clearTimeout(pushTimer)
      pushTimer = setTimeout(run, syncConfig.pushDelayMs)
    }
  })
  // One report at a time; entries a failed report did not send go with the
  // next successful run.
  let reporting = false
  const stopReports = engine.subscribe(() => {
    if (engine.getStatus().phase !== 'idle' || reporting) return
    reporting = true
    sendErrorReports(db, api)
      .catch((error: unknown) => {
        // Offline and error statuses are expected or recorded already.
        const expected = error instanceof ApiRequestError || error instanceof NotSignedInError
        if (navigator.onLine && !expected) reportError('api', error)
      })
      .finally(() => {
        reporting = false
      })
  })
  window.addEventListener('online', run)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearTimeout(pushTimer)
    changes.unsubscribe()
    stopReports()
    window.removeEventListener('online', run)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
