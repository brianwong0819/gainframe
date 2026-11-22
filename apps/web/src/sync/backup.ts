// The app's one sync engine and what starts it: the app opening, a connection
// returning, the app coming back to the foreground, a sign-in, and each change
// written to the outbox (after a short delay, so a burst of sets goes in one
// push). Null in a build without sign-in.
import { syncConfig } from '@gainframe/shared'
import { liveQuery } from 'dexie'

import { createApiClient } from '../api/client'
import { readAuthConfig } from '../auth/config'
import { loadSession } from '../db/auth-session'
import { db } from '../db/client'
import { reportError } from '../diagnostics/report'

import { createSyncEngine } from './engine'

const config = readAuthConfig()

export const backup =
  config === null
    ? null
    : createSyncEngine({
        db,
        api: createApiClient({
          db,
          config,
          onFailure: (message) => {
            reportError('api', message)
          },
        }),
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
      })

// Starts the triggers; returns a function that stops them.
export function startBackup(): () => void {
  const engine = backup
  if (engine === null) return () => undefined
  const run = () => void engine.run()
  const onVisible = () => {
    if (document.visibilityState === 'visible') run()
  }
  let pushTimer: ReturnType<typeof setTimeout> | undefined
  let last: { account: string; pending: number } | null = null
  // Fires once on subscribe, which is the run at launch. A token refresh also
  // rewrites the session and a push empties the outbox, so only a change of
  // account or expiry, or a new outbox entry, starts a run.
  const changes = liveQuery(async () => {
    const session = await loadSession(db)
    return {
      account: session === null ? '' : `${session.userId} ${String(session.expired)}`,
      pending: await db.outbox.count(),
    }
  }).subscribe((next) => {
    const accountChanged = last?.account !== next.account
    const added = last !== null && next.pending > last.pending
    last = next
    if (accountChanged) {
      clearTimeout(pushTimer)
      run()
    } else if (added) {
      clearTimeout(pushTimer)
      pushTimer = setTimeout(run, syncConfig.pushDelayMs)
    }
  })
  window.addEventListener('online', run)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearTimeout(pushTimer)
    changes.unsubscribe()
    window.removeEventListener('online', run)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
