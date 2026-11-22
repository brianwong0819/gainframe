import { useSyncExternalStore } from 'react'

import { db } from '@/db/client'
import { readBackupState } from '@/db/sync'
import { useLiveQuery } from '@/db/use-live-query'
import { backup } from '@/sync/backup'
import type { SyncStatus } from '@/sync/engine'
import { backupView } from '@/sync/view'

import { useOnline } from './use-online'

const notStarted: SyncStatus = { phase: 'signedOut', failingSince: null }
const noEngine = () => () => undefined
const loadState = () => readBackupState(db)

// The backup status for the icon, its sheet, the Today card, the account page
// and Diagnostics; undefined while loading.
export function useBackup() {
  const status = useSyncExternalStore(
    backup?.subscribe ?? noEngine,
    backup?.getStatus ?? (() => notStarted),
    () => notStarted,
  )
  const state = useLiveQuery(loadState)
  const online = useOnline()
  if (state === undefined) return undefined
  return {
    ...backupView({
      status,
      session: state.session,
      pending: state.pending,
      online,
      now: new Date(),
    }),
    email: state.session?.email ?? null,
    pending: state.pending,
    lastSyncAt: state.lastSyncAt,
  }
}

export type Backup = NonNullable<ReturnType<typeof useBackup>>

export function backUpNow(): void {
  void backup?.run()
}
