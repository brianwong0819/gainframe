// The sync engine (ADR-0003, M2-05): pushes the outbox in batches, then pulls
// what changed on the server since the stored cursor. One run at a time; a run
// asked for while one is going starts again when it ends. Failures retry with
// backoff. The only code that calls /api/sync.
import {
  pullResponseSchema,
  pushResponseSchema,
  SYNC_VERSION,
  SYNC_VERSION_HEADER,
  syncConfig,
} from '@gainframe/shared'

import { type ApiClient, ApiRequestError, NotSignedInError } from '../api/client'
import { loadSession } from '../db/auth-session'
import type { GainframeDb } from '../db/schema'
import {
  applyPulledPage,
  type PulledRow,
  readCursor,
  readPushBatch,
  type RejectedRow,
  saveLastSync,
  settlePush,
} from '../db/sync'

// signedOut: nothing to do. idle: the last run succeeded. offline: the device
// has no connection; it retries when one returns. failed: the last run failed
// and a retry is scheduled. needsSignIn: the session expired. updateRequired:
// the server no longer accepts this app's sync version.
export type SyncPhase =
  'signedOut' | 'idle' | 'syncing' | 'offline' | 'failed' | 'needsSignIn' | 'updateRequired'

export interface SyncStatus {
  phase: SyncPhase
  // When the current run of failures began, so a failure that lasts a day can
  // be shown as needing the user ("Accounts and backup").
  failingSince: string | null
}

const headers = { [SYNC_VERSION_HEADER]: String(SYNC_VERSION) }

interface SyncEngineOptions {
  db: GainframeDb
  api: ApiClient
  isOnline: () => boolean
  // Rows the server refused for good, and pulled rows this app cannot read.
  onRejected: (rows: RejectedRow[]) => void
  onUnreadable: (rows: PulledRow[]) => void
  now?: () => Date
  setTimer?: (run: () => void, ms: number) => () => void
}

export function retryDelayMs(failures: number): number {
  return Math.min(syncConfig.retryBaseMs * 2 ** Math.max(failures - 1, 0), syncConfig.retryMaxMs)
}

const defaultTimer = (run: () => void, ms: number) => {
  const id = setTimeout(run, ms)
  return () => {
    clearTimeout(id)
  }
}

export function createSyncEngine({
  db,
  api,
  isOnline,
  onRejected,
  onUnreadable,
  now = () => new Date(),
  setTimer = defaultTimer,
}: SyncEngineOptions) {
  let status: SyncStatus = { phase: 'signedOut', failingSince: null }
  const listeners = new Set<() => void>()
  let running: Promise<void> | null = null
  let again = false
  let failures = 0
  let cancelRetry: (() => void) | null = null

  function setStatus(next: SyncStatus) {
    status = next
    for (const listener of listeners) listener()
  }

  async function push() {
    for (;;) {
      const batch = await readPushBatch(db, syncConfig.pushBatchMax)
      if (batch.length === 0) return
      const { results } = await api.request(pushResponseSchema, {
        method: 'POST',
        path: '/api/sync/push',
        body: { rows: batch.map(({ table, row }) => ({ table, row })) },
        headers,
      })
      if (results.length !== batch.length) throw new Error('push answered a different row count')
      const { removed, rejected } = await settlePush(db, batch, results)
      if (rejected.length > 0) onRejected(rejected)
      // Only rows held back for clock skew are left: stop until the next run.
      if (removed === 0) return
    }
  }

  async function pull(userId: string) {
    let cursor = await readCursor(db, userId)
    for (;;) {
      const page = await api.request(pullResponseSchema, {
        method: 'GET',
        path: `/api/sync/pull?cursor=${String(cursor)}`,
        headers,
      })
      const unreadable = await applyPulledPage(db, userId, page.rows, page.cursor)
      if (unreadable.length > 0) onUnreadable(unreadable)
      cursor = page.cursor
      if (!page.more) return
    }
  }

  function failed(error: unknown) {
    if (error instanceof NotSignedInError) {
      setStatus({ phase: error.expired ? 'needsSignIn' : 'signedOut', failingSince: null })
      return
    }
    if (error instanceof ApiRequestError && error.code === 'update_required') {
      setStatus({ phase: 'updateRequired', failingSince: null })
      return
    }
    failures += 1
    setStatus({
      phase: isOnline() ? 'failed' : 'offline',
      failingSince: status.failingSince ?? now().toISOString(),
    })
    cancelRetry = setTimer(() => void run(), retryDelayMs(failures))
  }

  async function once() {
    cancelRetry?.()
    cancelRetry = null
    const session = await loadSession(db)
    if (session === null || session.expired) {
      setStatus({ phase: session === null ? 'signedOut' : 'needsSignIn', failingSince: null })
      return
    }
    setStatus({ ...status, phase: 'syncing' })
    try {
      await push()
      await pull(session.userId)
      await saveLastSync(db, now())
      failures = 0
      setStatus({ phase: 'idle', failingSince: null })
    } catch (error) {
      failed(error)
    }
  }

  // Starts a run, or marks one to follow the run in progress. Resolves when no
  // run is left.
  async function run(): Promise<void> {
    if (running !== null) {
      again = true
      return running
    }
    const takeAgain = () => {
      const asked = again
      again = false
      return asked
    }
    running = (async () => {
      do await once()
      while (takeAgain())
    })().finally(() => {
      running = null
    })
    return running
  }

  return {
    run,
    getStatus: () => status,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type SyncEngine = ReturnType<typeof createSyncEngine>
