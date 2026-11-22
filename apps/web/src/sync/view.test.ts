import { describe, expect, it } from 'vitest'

import type { SyncPhase } from './engine'
import { backupView } from './view'

const now = new Date('2026-11-22T12:00:00.000Z')
const signedIn = { expired: false }

function view(phase: SyncPhase, overrides: Partial<Parameters<typeof backupView>[0]> = {}) {
  return backupView({
    status: { phase, failingSince: null },
    session: signedIn,
    pending: 0,
    online: true,
    now,
    ...overrides,
  })
}

describe('backup view', () => {
  it('shows nothing signed out', () => {
    expect(view('idle', { session: null })).toEqual({ state: 'signedOut', needsUser: false })
  })

  it('asks for a new sign-in or an update, whatever else is going on', () => {
    expect(view('syncing', { session: { expired: true } })).toEqual({
      state: 'expired',
      needsUser: true,
    })
    expect(view('needsSignIn')).toEqual({ state: 'expired', needsUser: true })
    expect(view('updateRequired')).toEqual({ state: 'update', needsUser: true })
  })

  it('treats offline as ordinary', () => {
    expect(view('idle', { online: false, pending: 3 })).toEqual({
      state: 'offline',
      needsUser: false,
    })
    expect(view('offline')).toEqual({ state: 'offline', needsUser: false })
  })

  it('needs the user once a failure has lasted a day', () => {
    const failing = (since: string) =>
      view('failed', { status: { phase: 'failed', failingSince: since } })
    expect(failing('2026-11-22T00:00:00.000Z')).toEqual({ state: 'retry', needsUser: false })
    expect(failing('2026-11-21T12:00:00.000Z')).toEqual({ state: 'retry', needsUser: true })
  })

  it('is backed up only with nothing waiting', () => {
    expect(view('idle').state).toBe('ok')
    expect(view('idle', { pending: 2 }).state).toBe('busy')
    expect(view('signedOut', { pending: 2 }).state).toBe('busy')
    expect(view('syncing').state).toBe('busy')
  })
})
