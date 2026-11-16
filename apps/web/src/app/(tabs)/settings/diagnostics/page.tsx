'use client'

import { useTranslations } from 'next-intl'

import { Diagnostics } from '@/features/settings/diagnostics'
import { BackLink } from '@/ui/back-link'

export default function DiagnosticsPage() {
  const t = useTranslations('settings')
  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <BackLink href="/settings" label={t('title')} />
        <h1 className="text-title">{t('diagnostics')}</h1>
      </header>
      <Diagnostics />
    </main>
  )
}
