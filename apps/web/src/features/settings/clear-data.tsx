'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { backUpNow, useBackup } from '@/features/account/use-backup'
import { useOnline } from '@/features/account/use-online'
import { clearAllData } from '@/db/clear'
import { db } from '@/db/client'
import { reportError } from '@/diagnostics/report'
import { ConfirmButton } from '@/ui/confirm-button'
import { Pressable } from '@/ui/pressable'

// "Clear all data": resets the device to a first launch without deleting and
// reinstalling the Home Screen app. The language choice lives in localStorage
// and is kept. After clearing, the app reloads at Today so no screen keeps
// state read from the old rows. Signed in, only this device is cleared: the
// session stays and the next sync downloads the account's records again
// ("Accounts and backup"). Changes not yet backed up are named first, with a
// way to back them up, and clearing them takes two taps; it is never refused.
export function ClearData() {
  const t = useTranslations('diagnostics')
  const backup = useBackup()
  const online = useOnline()
  const [failed, setFailed] = useState(false)
  if (backup === undefined) return null
  const signedIn = backup.state !== 'signedOut'
  const count = backup.pending

  function clear() {
    setFailed(false)
    clearAllData(db, { keepSession: signedIn }).then(
      () => {
        window.location.replace('/')
      },
      (reason: unknown) => {
        setFailed(true)
        reportError('unhandledrejection', reason)
      },
    )
  }

  const [title, hint, label, confirmLabel] = !signedIn
    ? [t('clear'), t('clearHint'), t('clearAll'), t('clearConfirm')]
    : count > 0
      ? [
          t('clearPendingTitle', { count }),
          t('clearPendingHint'),
          t('clearPendingAnyway', { count }),
          t('clearPendingConfirm', { count }),
        ]
      : [t('clearDevice'), t('clearDeviceHint'), t('clearDevice'), t('clearConfirm')]

  return (
    <section className="flex flex-col gap-12">
      <h2 className="text-label text-ink-3">{t('clear')}</h2>
      <div className="flex flex-col gap-12 rounded-group bg-surface p-16">
        {signedIn && <p className="text-body font-semibold text-ink">{title}</p>}
        <p className="text-label text-ink-2">{hint}</p>
        {signedIn && count > 0 && (
          <>
            <Pressable
              onClick={backUpNow}
              disabled={!online}
              className="rounded-ctl bg-ink py-12 text-body font-semibold text-bg disabled:opacity-40"
            >
              {t('backUpFirst')}
            </Pressable>
            {!online && <p className="text-label text-ink-3">{t('backUpOffline')}</p>}
          </>
        )}
        <ConfirmButton label={label} confirmLabel={confirmLabel} onConfirm={clear} />
        {failed && <p className="text-label text-ink-2">{t('clearFailed')}</p>}
      </div>
    </section>
  )
}
