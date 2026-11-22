// What the backup status shows ("Accounts and backup" in docs/design-system.md),
// derived from the engine's status and what the device holds.
import { syncConfig } from '@gainframe/shared'

import type { SyncStatus } from './engine'

// signedOut: no icon. ok, busy, offline, retry: the icon and its sheet.
// expired, update: also a card that leads Today; so does `retry` once it has
// failed for longer than `syncConfig.needsUserAfterMs`.
export type BackupState = 'signedOut' | 'ok' | 'busy' | 'offline' | 'retry' | 'expired' | 'update'

export interface BackupView {
  state: BackupState
  // Whether Today shows a card asking the user to act.
  needsUser: boolean
}

interface BackupInputs {
  status: SyncStatus
  session: { expired: boolean } | null
  pending: number
  online: boolean
  now: Date
}

export function backupView({ status, session, pending, online, now }: BackupInputs): BackupView {
  if (session === null) return { state: 'signedOut', needsUser: false }
  if (session.expired || status.phase === 'needsSignIn')
    return { state: 'expired', needsUser: true }
  if (status.phase === 'updateRequired') return { state: 'update', needsUser: true }
  if (status.phase === 'syncing') return { state: 'busy', needsUser: false }
  if (!online || status.phase === 'offline') return { state: 'offline', needsUser: false }
  if (status.phase === 'failed') {
    const since = status.failingSince === null ? now.getTime() : Date.parse(status.failingSince)
    return { state: 'retry', needsUser: now.getTime() - since >= syncConfig.needsUserAfterMs }
  }
  // Idle, or not run yet: changes waiting are about to go.
  return { state: pending > 0 ? 'busy' : 'ok', needsUser: false }
}
