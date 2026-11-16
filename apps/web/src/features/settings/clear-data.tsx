'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { clearAllData } from '@/db/clear'
import { db } from '@/db/client'
import { reportError } from '@/diagnostics/report'
import { ConfirmButton } from '@/ui/confirm-button'

// "Clear all data": resets the device to a first launch without deleting and
// reinstalling the Home Screen app. The language choice lives in localStorage
// and is kept. After clearing, the app reloads at Today so no screen keeps
// state read from the old rows.
export function ClearData() {
  const t = useTranslations('diagnostics')
  const [failed, setFailed] = useState(false)

  function clear() {
    setFailed(false)
    clearAllData(db).then(
      () => {
        window.location.replace('/')
      },
      (reason: unknown) => {
        setFailed(true)
        reportError('unhandledrejection', reason)
      },
    )
  }

  return (
    <section className="flex flex-col gap-12">
      <h2 className="text-label text-ink-3">{t('clear')}</h2>
      <div className="flex flex-col gap-12 rounded-group bg-surface p-16">
        <p className="text-label text-ink-2">{t('clearHint')}</p>
        <ConfirmButton label={t('clearAll')} confirmLabel={t('clearConfirm')} onConfirm={clear} />
        {failed && <p className="text-label text-ink-2">{t('clearFailed')}</p>}
      </div>
    </section>
  )
}
