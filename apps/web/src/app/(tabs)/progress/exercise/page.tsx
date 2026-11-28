'use client'

import { useTranslations } from 'next-intl'

import { ExerciseProgress } from '@/features/progress/exercise-progress'
import { BackLink } from '@/ui/back-link'
import { useIdFromHash } from '@/ui/use-id-from-hash'

// One exercise's strength over time: `/progress/exercise#<exercise id>`.
export default function ExercisePage() {
  const tProgress = useTranslations('progress')
  const exerciseId = useIdFromHash()
  return (
    <main className="flex flex-col gap-20">
      {exerciseId === undefined ? (
        <BackLink href="/progress" label={tProgress('title')} />
      ) : (
        <ExerciseProgress exerciseId={exerciseId} />
      )}
    </main>
  )
}
