'use client'

import type { LocalDate } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { MuscleSection } from '@/features/progress/muscle-section'
import { WeeklyVolume } from '@/features/progress/weekly-volume'
import { BackLink } from '@/ui/back-link'

// Training volume ("Progress charts" and "Muscle map" in
// docs/design-system.md): the weekly bars, then the muscle section, which
// follows the week selected on the bars.
export default function VolumePage() {
  const t = useTranslations('progress.volume')
  const tProgress = useTranslations('progress')
  const [selected, setSelected] = useState<{
    index: number
    from: LocalDate
    to: LocalDate
  } | null>(null)
  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <BackLink href="/progress" label={tProgress('title')} />
        <h1 className="text-title">{t('title')}</h1>
      </header>
      <WeeklyVolume
        selected={selected?.index ?? null}
        onSelect={(index, week) => {
          setSelected(index === null || week === null ? null : { index, ...week })
        }}
      />
      <MuscleSection
        selected={selected}
        onReset={() => {
          setSelected(null)
        }}
      />
    </main>
  )
}
