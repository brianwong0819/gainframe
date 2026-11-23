'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { z } from 'zod'

import { ApiRequestError } from '@/api/client'
import { readAuthConfig } from '@/auth/config'
import { logoutUrl } from '@/auth/sign-out'
import { clearAllData } from '@/db/clear'
import { db } from '@/db/client'
import { reportError } from '@/diagnostics/report'
import { api } from '@/sync/backup'
import { ConfirmButton } from '@/ui/confirm-button'

import { useOnline } from './use-online'

const config = readAuthConfig()

// Deletes the account on the server, then empties the device and leaves for
// managed login's /logout, which clears its own cookie and returns to Settings.
// The refresh token needs no revoking: the user it belonged to is gone.
async function deleteAccount(): Promise<void> {
  if (config === null || api === null) return
  await api.request(z.undefined(), { method: 'DELETE', path: '/api/account' })
  await clearAllData(db)
  window.location.assign(logoutUrl(config, window.location.origin))
}

type Step = 'idle' | 'deleting' | 'failed'

// "Delete account and all records" ("Accounts and backup"): asks twice and
// says that nothing can be restored. It needs a connection; a failure leaves
// the account and the device as they were, so it can be tried again.
export function DeleteAccount() {
  const t = useTranslations('account')
  const online = useOnline()
  const [step, setStep] = useState<Step>('idle')

  const run = () => {
    setStep('deleting')
    deleteAccount().catch((error: unknown) => {
      // An error status was recorded by the API client; anything else is new.
      if (online && !(error instanceof ApiRequestError)) {
        reportError('unhandledrejection', error)
      }
      setStep('failed')
    })
  }

  return (
    <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
      <p className="text-body text-ink-2">{t('deleteBody')}</p>
      {step === 'deleting' ? (
        <p className="text-label text-ink-2" aria-live="polite">
          {t('deleting')}
        </p>
      ) : online ? (
        <ConfirmButton label={t('delete')} confirmLabel={t('deleteConfirm')} onConfirm={run} />
      ) : (
        <p className="text-label text-ink-3">{t('deleteOffline')}</p>
      )}
      {step === 'failed' && (
        <p className="text-label text-ink" role="alert">
          {t('deleteFailed')}
        </p>
      )}
    </section>
  )
}
