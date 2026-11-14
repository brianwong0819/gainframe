'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { loadWorkoutSummary } from '@/db/workout-summary'
import { WorkoutSummaryView } from '@/features/workout/workout-summary'
import { BackLink } from '@/ui/back-link'
import { PressableLink } from '@/ui/pressable'
import { useIdFromHash } from '@/ui/use-id-from-hash'

// A finished workout's summary, at /workout/summary#<id>; finishing a workout
// opens it.
export default function WorkoutSummaryPage() {
  const t = useTranslations('summary')
  const tWorkout = useTranslations('workout')
  const workoutId = useIdFromHash()
  const query = useMemo(
    () => () =>
      workoutId === null || workoutId === undefined
        ? Promise.resolve(null)
        : loadWorkoutSummary(db, workoutId),
    [workoutId],
  )
  const state = useLiveQuery(query)
  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <BackLink href="/workout" label={tWorkout('title')} />
        <h1 className="text-title">{t('title')}</h1>
      </header>
      {workoutId !== undefined && state && <WorkoutSummaryView state={state} />}
      {workoutId !== undefined && state === null && (
        <p className="text-body text-ink-2">{t('missing')}</p>
      )}
      <PressableLink
        href="/workout"
        className="rounded-ctl bg-ink py-12 text-center text-body font-semibold text-bg"
      >
        {t('done')}
      </PressableLink>
    </main>
  )
}
