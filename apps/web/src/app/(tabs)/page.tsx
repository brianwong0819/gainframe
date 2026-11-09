'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { LanguageSwitch } from './language-switch'
import { TabScreen } from './tab-screen'

// Dev builds only; English because these are developer tools outside the i18n
// catalogues (see next.config.ts).
const devPages = [
  { href: '/dev/rest-timer', label: 'Rest timer test' },
  { href: '/dev/kitchen-sink', label: 'Kitchen sink' },
  { href: '/dev/database', label: 'Local database' },
] as const

export default function TodayPage() {
  const t = useTranslations('today')
  return (
    <TabScreen title={t('title')}>
      <p className="text-body text-ink-2">{t('empty')}</p>
      <LanguageSwitch />
      {process.env.NEXT_PUBLIC_DEV_PAGES === '1' && (
        <nav aria-label="Dev pages" className="flex flex-col">
          {devPages.map((page) => (
            <Link key={page.href} href={page.href} className="py-12 text-body text-accent">
              {page.label}
            </Link>
          ))}
        </nav>
      )}
    </TabScreen>
  )
}
