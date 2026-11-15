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
import { exerciseLines, mainMuscles } from './card-lines'
import { formatDay, formatMonth, formatTime } from './dates'

const loadHistory = () => loadWorkoutHistory(db)
// Custom exercises including deleted ones, so names never go missing.
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()

// How many exercises a card names before "2 more exercises", and how many of
// its main muscle groups it tags.
const shownExercises = 3
const shownMuscles = 3

// Finished workouts, newest first, under a heading per month. Each card shows
// the plan day (or "Free workout") with its plan and time, the muscle groups
// trained most, each exercise once with its sets, and the time, sets, volume
// and records; a tap opens its detail.
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
  entry: { workout, summary, planName, dayName },
  custom,
}: {
  entry: WorkoutSummaryState
  custom: readonly Exercise[]
}) {
  const t = useTranslations('history')
  const tSummary = useTranslations('summary')
  const tMuscle = useTranslations('muscle')
  const locale = useLocale()
  const duration = useDurationText()
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const lines = exerciseLines(summary.exercises)
  const muscles = mainMuscles(lines, (id) => findExercise(id, custom).muscle, shownMuscles)
  const hidden = lines.length - shownExercises
  const when = t('when', {
    date: formatDay(workout.localDate, locale),
    time: formatTime(workout.startedAt, locale),
  })
  const figures = [
    // The duration mixes digits and words, which the monospaced number face
    // would stretch, so only the pure numbers use it.
    { label: tSummary('duration'), value: duration(summary.durationS ?? 0), num: false },
    { label: tSummary('sets'), value: String(summary.setsDone), num: true },
    { label: tSummary('volume'), value: `${number.format(summary.volumeKg)} kg`, num: true },
  ]

  return (
    <PressableLink
      href={`/workout/past#${workout.id}`}
      className="flex items-center justify-between gap-12 rounded-group bg-surface p-16"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-12">
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
          <span className="truncate text-label text-ink-3">
            {planName === null ? when : `${planName} · ${when}`}
          </span>
        </span>
        {muscles.length > 0 && (
          <span className="flex flex-wrap gap-4">
            {muscles.map((muscle) => (
              <span
                key={muscle}
                className="rounded-full bg-accent-wash px-8 text-label font-semibold text-accent"
              >
                {tMuscle(muscle)}
              </span>
            ))}
          </span>
        )}
        <span className="flex flex-col text-label text-ink-2">
          {lines.slice(0, shownExercises).map(({ exerciseId, sets }) => (
            <span key={exerciseId} className="truncate">
              {t('exerciseSets', {
                name: exerciseName(findExercise(exerciseId, custom), locale),
                sets,
              })}
            </span>
          ))}
          {hidden > 0 && (
            <span className="text-ink-3">{t('moreExercises', { count: hidden })}</span>
          )}
        </span>
        <span className="grid grid-cols-[3fr_2fr_3fr] gap-8 border-t border-line pt-12">
          {figures.map(({ label, value, num }) => (
            <span key={label} className="flex min-w-0 flex-col">
              <span className="text-label text-ink-3">{label}</span>
              <span className={`${num ? 'num ' : ''}truncate text-body text-ink`}>{value}</span>
            </span>
          ))}
        </span>
      </span>
      <span className="text-ink-3">
        <Chevron direction="right" />
      </span>
    </PressableLink>
  )
}
