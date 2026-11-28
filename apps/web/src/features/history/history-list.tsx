'use client'

import { type Exercise, totalWorkouts } from '@gainframe/shared'
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
import { exerciseLines, mainMuscles } from './card-lines'
import { formatDay, formatMonth, formatTime } from './dates'

const loadHistory = () => loadWorkoutHistory(db)
// Custom exercises including deleted ones, so names never go missing.
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()

// How many of its main muscle groups a card tags.
const shownMuscles = 3

// Finished workouts, newest first, under a heading per month with what the
// month added up to. Each card shows the plan day (or "Free workout") with its
// plan and time, the muscle groups trained most, the exercises on one line,
// and the time, sets, volume and records; a tap opens its detail.
export function HistoryList() {
  const t = useTranslations('history')
  const locale = useLocale()
  const entries = useLiveQuery(loadHistory)
  const custom = useLiveQuery(allCustomExercises) ?? []
  if (entries === undefined) return null
  if (entries.length === 0) return <p className="text-body text-ink-2">{t('none')}</p>

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const months = Map.groupBy(entries, ({ workout }) => workout.localDate.slice(0, 7))
  return (
    <>
      {[...months.values()].map((month) => {
        const first = month[0]
        if (first === undefined) return null
        const heading = formatMonth(first.workout.localDate, locale)
        const totals = totalWorkouts(month)
        return (
          <section key={heading} aria-label={heading} className="flex flex-col gap-8">
            <div className="flex items-baseline justify-between gap-8">
              <h2 className="text-label font-semibold text-ink-3">{heading}</h2>
              <p className="text-label text-ink-3">
                {t('monthTotals', {
                  workouts: totals.workouts,
                  sets: totals.setsDone,
                  volume: number.format(totals.volumeKg),
                })}
              </p>
            </div>
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
  entry: { workout, summary, planName, dayName },
  custom,
}: {
  entry: WorkoutSummaryState
  custom: readonly Exercise[]
}) {
  const t = useTranslations('history')
  const tMuscle = useTranslations('muscle')
  const locale = useLocale()
  const duration = useDurationText()
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const lines = exerciseLines(summary.exercises)
  const muscles = mainMuscles(lines, (id) => findExercise(id, custom).muscle, shownMuscles)
  const names = new Intl.ListFormat(locale, { type: 'conjunction', style: 'narrow' }).format(
    lines.map(({ exerciseId }) => exerciseName(findExercise(exerciseId, custom), locale)),
  )
  const when = t('when', {
    date: formatDay(workout.localDate, locale),
    time: formatTime(workout.startedAt, locale),
  })

  return (
    <PressableLink
      href={`/workout/past#${workout.id}`}
      className="flex items-center justify-between gap-12 rounded-group bg-surface p-16"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-8">
        <span className="flex flex-col gap-4">
          <span className="flex items-center gap-8">
            <span className="truncate text-body font-semibold text-ink">
              {dayName ?? t('untitled')}
            </span>
            {summary.recordCount > 0 && (
              <span className="shrink-0 rounded-full bg-accent-soft px-8 text-label font-semibold text-ink">
                {t('records', { count: summary.recordCount })}
              </span>
            )}
          </span>
          <span className="truncate text-label text-ink-3">
            {planName === null ? when : `${planName} · ${when}`}
          </span>
        </span>
        <span className="flex flex-col gap-4">
          <span className="flex items-center gap-8">
            {muscles.map((muscle) => (
              <span
                key={muscle}
                className="shrink-0 rounded-full bg-sunk px-8 text-label text-ink-2"
              >
                {tMuscle(muscle)}
              </span>
            ))}
            <span className="truncate text-label text-ink-2">{names}</span>
          </span>
          <span className="truncate text-label text-ink">
            {t('stats', {
              duration: duration(summary.durationS ?? 0),
              sets: summary.setsDone,
              volume: number.format(summary.volumeKg),
            })}
          </span>
        </span>
      </span>
      <span className="text-ink-3">
        <Chevron direction="right" />
      </span>
    </PressableLink>
  )
}
