'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useMemo } from 'react'

import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { loadWorkoutSummary } from '@/db/workout-summary'
import { formatDay, formatTime } from '@/features/history/dates'
import { PastWorkout } from '@/features/history/past-workout'
import { BackLink } from '@/ui/back-link'
import { useIdFromHash } from '@/ui/use-id-from-hash'

// One finished workout from history, at /workout/past#<id>: the same summary
// the finish screen shows, under the plan day and the date, with every set
// open to editing (`PastWorkout`).
export default function PastWorkoutPage() {
  const t = useTranslations('history')
  const tSummary = useTranslations('summary')
  const locale = useLocale()
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
        <BackLink href="/workout/history" label={t('title')} />
        <div className="flex flex-col gap-4">
          <h1 className="text-title">{state ? (state.dayName ?? t('untitled')) : t('title')}</h1>
          {state && (
            <p className="text-label text-ink-3">
              {t('when', {
                date: formatDay(state.workout.localDate, locale),
                time: formatTime(state.workout.startedAt, locale),
              })}
            </p>
          )}
          {state && state.summary.setsDone > 0 && (
            <p className="text-label text-ink-3">{t('editHint')}</p>
          )}
        </div>
      </header>
      {workoutId !== undefined && state && <PastWorkout state={state} />}
      {workoutId !== undefined && state === null && (
        <p className="text-body text-ink-2">{tSummary('missing')}</p>
      )}
    </main>
  )
}
