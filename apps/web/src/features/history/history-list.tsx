'use client'

import type { Exercise } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'

import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { loadWorkoutHistory } from '@/db/workout-history'
import type { WorkoutSummaryState } from '@/db/workout-summary'
import { Chevron } from '@/ui/chevron'
import { PressableLink } from '@/ui/pressable'

import { exerciseName } from '../exercises/library'
import { useDurationText } from '../workout/duration'
import { findExercise } from '../workout/exercise-info'
import { formatDay, formatMonth, formatTime } from './dates'

const loadHistory = () => loadWorkoutHistory(db)
// Custom exercises including deleted ones, so names never go missing.
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()

// How many exercises a card names before "2 more exercises".
const shownExercises = 4

// Finished workouts, newest first, under a heading per month. Each card shows
// the plan day (or "Free workout"), when it was, its exercises with their set
// counts, and its time, sets, volume and records; a tap opens its detail.
export function HistoryList() {
  const t = useTranslations('history')
  const locale = useLocale()
  const entries = useLiveQuery(loadHistory)
  const custom = useLiveQuery(allCustomExercises) ?? []
  if (entries === undefined) return null
  if (entries.length === 0) return <p className="text-body text-ink-2">{t('none')}</p>

  const months = Map.groupBy(entries, ({ workout }) => workout.localDate.slice(0, 7))
  return (
    <>
      {[...months.values()].map((month) => {
        const first = month[0]
        if (first === undefined) return null
        const heading = formatMonth(first.workout.localDate, locale)
        return (
          <section key={heading} aria-label={heading} className="flex flex-col gap-8">
            <h2 className="text-label font-semibold text-ink-3">{heading}</h2>
            <ul className="flex flex-col gap-8">
              {month.map((entry) => (
                <li key={entry.workout.id}>
                  <HistoryCard entry={entry} custom={custom} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}

function HistoryCard({
  entry: { workout, summary, dayName },
  custom,
}: {
  entry: WorkoutSummaryState
  custom: readonly Exercise[]
}) {
  const t = useTranslations('history')
  const locale = useLocale()
  const duration = useDurationText()
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const exercises = summary.exercises.filter(({ setsDone }) => setsDone > 0)
  const hidden = exercises.length - shownExercises

  return (
    <PressableLink
      href={`/workout/past#${workout.id}`}
      className="flex items-center justify-between gap-12 rounded-group bg-surface p-16"
    >
      <span className="flex min-w-0 flex-col gap-8">
        <span className="flex flex-col gap-4">
          <span className="flex items-center gap-8">
            <span className="truncate text-body font-semibold text-ink">
              {dayName ?? t('untitled')}
            </span>
            {summary.recordCount > 0 && (
              <span className="shrink-0 rounded-full bg-accent px-8 text-label font-semibold text-accent-ink">
                {t('records', { count: summary.recordCount })}
              </span>
            )}
          </span>
          <span className="text-label text-ink-3">
            {t('when', {
              date: formatDay(workout.localDate, locale),
              time: formatTime(workout.startedAt, locale),
            })}
          </span>
        </span>
        {exercises.length > 0 && (
          <span className="flex flex-col text-label text-ink-2">
            {exercises.slice(0, shownExercises).map(({ slot, setsDone }) => (
              <span key={slot.id} className="truncate">
                {t('exerciseSets', {
                  name: exerciseName(findExercise(slot.exerciseId, custom), locale),
                  sets: setsDone,
                })}
              </span>
            ))}
            {hidden > 0 && <span>{t('moreExercises', { count: hidden })}</span>}
          </span>
        )}
        <span className="text-label text-ink-3">
          {t('stats', {
            duration: duration(summary.durationS ?? 0),
            sets: summary.setsDone,
            volume: number.format(summary.volumeKg),
          })}
        </span>
      </span>
      <span className="text-ink-3">
        <Chevron direction="right" />
      </span>
    </PressableLink>
  )
}
