'use client'

import { useTranslations } from 'next-intl'

import { ManualEntry } from '@/features/food/manual-entry'
import { BackLink } from '@/ui/back-link'

export default function ManualEntryPage() {
  const t = useTranslations('food')
  return (
    <main className="flex flex-col gap-20">
      <BackLink href="/food" label={t('title')} />
      <ManualEntry />
    </main>
  )
}
