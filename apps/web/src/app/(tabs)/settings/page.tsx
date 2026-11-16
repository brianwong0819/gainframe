'use client'

import { useTranslations } from 'next-intl'

import { LanguageSwitch } from '@/features/settings/language-switch'
import { BackLink } from '@/ui/back-link'
import { Chevron } from '@/ui/chevron'
import { PressableLink } from '@/ui/pressable'

export default function SettingsPage() {
  const t = useTranslations('settings')
  const tToday = useTranslations('today')
  const tLanguage = useTranslations('language')
  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <BackLink href="/" label={tToday('title')} />
        <h1 className="text-title">{t('title')}</h1>
      </header>
      <section className="flex flex-col gap-8">
        <h2 className="text-label text-ink-3">{tLanguage('label')}</h2>
        <LanguageSwitch />
      </section>
      <PressableLink
        href="/settings/diagnostics"
        className="flex items-center justify-between gap-12 rounded-group bg-surface p-16"
      >
        <span className="flex flex-col">
          <span className="text-body text-ink">{t('diagnostics')}</span>
          <span className="text-label text-ink-3">{t('diagnosticsHint')}</span>
        </span>
        <span className="text-ink-3">
          <Chevron direction="right" />
        </span>
      </PressableLink>
    </main>
  )
}
