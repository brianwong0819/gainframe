'use client'

import { useTranslations } from 'next-intl'

import { TextEstimate } from '@/features/food/text-estimate'
import { BackLink } from '@/ui/back-link'

export default function TextEstimatePage() {
  const t = useTranslations('manual')
  return (
    <main className="flex flex-col gap-20">
      <BackLink href="/food/add" label={t('title')} />
      <TextEstimate />
    </main>
  )
}
