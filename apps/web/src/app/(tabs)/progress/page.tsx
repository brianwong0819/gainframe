'use client'

import { useTranslations } from 'next-intl'

import { WeightSummary } from '@/features/progress/weight-summary'
import { BackLink } from '@/ui/back-link'

// Progress ("Progress charts" in docs/design-system.md): below Today, one card
// per question. Weight is the first; strength, volume and protein follow in
// M4-06 and M4-07.
export default function ProgressPage() {
  const t = useTranslations('progress')
  const tToday = useTranslations('today')
  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <BackLink href="/" label={tToday('title')} />
        <h1 className="text-title">{t('title')}</h1>
      </header>
      <WeightSummary />
    </main>
  )
}
