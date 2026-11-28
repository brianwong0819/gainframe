'use client'

import { useTranslations } from 'next-intl'

import { MuscleSection } from '@/features/progress/muscle-section'
import { BackLink } from '@/ui/back-link'

// Training volume ("Muscle map" in docs/design-system.md). The muscle section
// comes first; M4-07 adds the weekly bars above it.
export default function VolumePage() {
  const t = useTranslations('progress.volume')
  const tProgress = useTranslations('progress')
  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <BackLink href="/progress" label={tProgress('title')} />
        <h1 className="text-title">{t('title')}</h1>
      </header>
      <MuscleSection />
    </main>
  )
}
