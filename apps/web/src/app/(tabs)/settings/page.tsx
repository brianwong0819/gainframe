'use client'

import { useTranslations } from 'next-intl'

import { AccountRow } from '@/features/account/account-row'
import { LanguageSwitch } from '@/features/settings/language-switch'
import { BackLink } from '@/ui/back-link'
import { Chevron } from '@/ui/chevron'
import { PressableLink } from '@/ui/pressable'

// The food table's sources, named as each asks to be cited (docs/design/credits.md).
const SOURCES = [
  { key: 'sourceMyfcd', href: 'https://myfcd.moh.gov.my/' },
  { key: 'sourceUsda', href: 'https://fdc.nal.usda.gov/' },
] as const

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
      <AccountRow />
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
      <section className="flex flex-col gap-8">
        <h2 className="text-label text-ink-3">{t('dataSources')}</h2>
        <ul className="flex flex-col gap-4 text-label text-ink-2">
          {SOURCES.map(({ key, href }) => (
            <li key={key}>
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
                {t(key)}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
