'use client'

import { useTranslations } from 'next-intl'

import { WeightProgress } from '@/features/progress/weight-progress'
import { BackLink } from '@/ui/back-link'

export default function WeightPage() {
  const t = useTranslations('progress.weight')
  const tProgress = useTranslations('progress')
  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <BackLink href="/progress" label={tProgress('title')} />
        <h1 className="text-title">{t('title')}</h1>
      </header>
      <WeightProgress />
    </main>
  )
}
