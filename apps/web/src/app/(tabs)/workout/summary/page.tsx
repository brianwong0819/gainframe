'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo } from 'react'

import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { loadWorkoutSummary } from '@/db/workout-summary'
import { takeJustFinished } from '@/features/workout/just-finished'
import { WorkoutSummaryView } from '@/features/workout/workout-summary'
import { BackLink } from '@/ui/back-link'
import { celebrationTiming, ripple } from '@/ui/celebration'
import { PressableLink } from '@/ui/pressable'
import { useIdFromHash } from '@/ui/use-id-from-hash'

// A finished workout's summary, at /workout/summary#<id>; finishing a workout
// opens it, and then rings pulse out from the record count (the ripple tier).
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
  const loaded = state !== undefined && state !== null
  useEffect(() => {
    if (!loaded || workoutId === null || workoutId === undefined) return
    if (!takeJustFinished(workoutId)) return
    // Not cleared on unmount: the ripple is drawn over the page, so a late one
    // is harmless, and clearing it would lose it to a development re-mount.
    setTimeout(() => {
      const anchor = document.querySelector('[data-celebration-anchor]')
      if (anchor !== null) ripple(anchor)
    }, celebrationTiming.rippleDelayS * 1000)
  }, [loaded, workoutId])
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
