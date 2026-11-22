'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { readAuthConfig } from '@/auth/config'
import { logoutUrl, revokeRefreshToken } from '@/auth/sign-out'
import { loadSession } from '@/db/auth-session'
import { clearAllData } from '@/db/clear'
import { db } from '@/db/client'
import { pendingRowCount } from '@/db/sync'
import { reportError } from '@/diagnostics/report'
import { backup as engine } from '@/sync/backup'
import { ConfirmButton } from '@/ui/confirm-button'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

import type { Backup } from './use-backup'
import { useOnline } from './use-online'

const config = readAuthConfig()

// Revokes the refresh token, removes everything from the device and leaves for
// managed login's /logout, which returns to Settings (ADR-0007).
async function signOut(): Promise<void> {
  if (config === null) return
  const session = await loadSession(db)
  if (session !== null) await revokeRefreshToken(config, session.refreshToken)
  await clearAllData(db)
  window.location.assign(logoutUrl(config, window.location.origin))
}

// "Sign out" ("Accounts and backup"). With nothing waiting it is one button.
// With changes waiting the title is their count, the main button backs them up
// first, and losing them takes two taps. It is never refused, so a broken
// backup still leaves a way out.
export function SignOutSheet({
  backup,
  open,
  onClose,
}: {
  backup: Backup
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations('account')
  const online = useOnline()
  const [busy, setBusy] = useState(false)
  const count = backup.pending

  function run(task: () => Promise<void>) {
    setBusy(true)
    task().catch((error: unknown) => {
      setBusy(false)
      reportError('unhandledrejection', error)
    })
  }

  const backUpThenSignOut = () => {
    run(async () => {
      await engine?.run()
      if ((await pendingRowCount(db)) === 0) await signOut()
      else setBusy(false)
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('signOut')} closeLabel={t('close')}>
      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-4">
          <p className="text-section">
            {count > 0 ? t('signOutPendingTitle', { count }) : t('signOutTitle')}
          </p>
          <p className="text-body text-ink-2">
            {count > 0 ? t('signOutPendingBody') : t('signOutBody')}
          </p>
        </div>
        {count > 0 ? (
          <>
            <Pressable
              onClick={backUpThenSignOut}
              disabled={!online || busy}
              className="rounded-ctl bg-ink py-12 text-body font-semibold text-bg disabled:opacity-40"
            >
              {t('backUpThenSignOut')}
            </Pressable>
            {!online && <p className="text-label text-ink-3">{t('backUpOffline')}</p>}
            <ConfirmButton
              label={t('signOutAnyway', { count })}
              confirmLabel={t('signOutAnywayConfirm', { count })}
              onConfirm={() => {
                run(signOut)
              }}
            />
          </>
        ) : (
          <Pressable
            onClick={() => {
              run(signOut)
            }}
            disabled={busy}
            className="rounded-ctl bg-ink py-12 text-body font-semibold text-bg disabled:opacity-40"
          >
            {t('signOut')}
          </Pressable>
        )}
      </div>
    </Sheet>
  )
}
