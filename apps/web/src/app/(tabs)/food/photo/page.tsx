'use client'

import { useTranslations } from 'next-intl'

import { PhotoEstimate } from '@/features/food/photo-estimate'
import { BackLink } from '@/ui/back-link'

export default function PhotoEstimatePage() {
  const t = useTranslations('food')
  return (
    <main className="flex flex-col gap-20">
      <BackLink href="/food" label={t('title')} />
      <PhotoEstimate />
    </main>
  )
}
