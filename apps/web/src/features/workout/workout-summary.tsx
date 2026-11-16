'use client'

import {
  compareSummaries,
  estimateOneRepMax,
  type Exercise,
  type ExerciseSummary,
  type RecordKind,
  type WeightUnit,
  type WorkoutSet,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { db, weightUnits } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import type { WorkoutSummaryDetail } from '@/db/workout-summary'

import { exerciseName } from '../exercises/library'
import { useDurationText } from './duration'
import { findExercise, formatSetWeight, formatWeight, isBodyweight } from './exercise-info'

// Custom exercises including deleted ones, so names never go missing.
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()
const loadWeightUnits = () => weightUnits.all()

// What a workout added up to: volume first, compared with the last time the
// same plan day was done, then each exercise with its top set and records.
// Shown when a workout ends and in history, where
// `setList` adds each exercise's sets below its records; `setText` formats a
// set as the summary does ("80 kg × 5").
export function WorkoutSummaryView({
  state,
  setList,
}: {
  state: WorkoutSummaryDetail
  setList?: (exercise: ExerciseSummary, setText: (set: WorkoutSet) => string) => ReactNode
}) {
  const t = useTranslations('summary')
  const tWorkout = useTranslations('workout')
  const locale = useLocale()
  const custom = useLiveQuery(allCustomExercises) ?? []
  const units = useLiveQuery(loadWeightUnits)
  const { summary, previous, dayName } = state
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  })
  const comparison = previous === null ? null : compareSummaries(summary, previous)
  const volumeChange = comparison?.volumeChange ?? null

  const duration = useDurationText()
  const figures = [
    { label: t('duration'), value: duration(summary.durationS ?? 0) },
    { label: t('sets'), value: String(summary.setsDone) },
    { label: t('records'), value: String(summary.recordCount), anchor: true },
  ]

  const exercises = summary.exercises.filter(({ setsDone }) => setsDone > 0)
  return (
    <>
      <dl className="flex flex-wrap gap-x-28 gap-y-16 rounded-group bg-surface p-16">
        <div className="flex w-full flex-col gap-4">
          <dt className="text-label text-ink-3">{t('volume')}</dt>
          <dd className="flex flex-wrap items-baseline gap-8">
            <span>
              <span className="num text-title text-ink">{number.format(summary.volumeKg)}</span>
              <span className="text-label text-ink-3"> {tWorkout('unit.kg')}</span>
            </span>
            {volumeChange !== null && (
              <span
                className={
                  volumeChange > 0
                    ? 'rounded-full bg-accent px-8 text-label font-semibold text-accent-ink'
                    : 'text-label text-ink-2'
                }
              >
                <span className="num">{percent.format(volumeChange)}</span>{' '}
                {dayName === null ? t('vsLast') : t('vsLastDay', { day: dayName })}
              </span>
            )}
          </dd>
        </div>
        {figures.map(({ label, value, anchor }) => (
          <div key={label} className="flex flex-col gap-4">
            <dt className="text-label text-ink-3">{label}</dt>
            <dd className="num text-body font-semibold text-ink" data-celebration-anchor={anchor}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {exercises.length === 0 && <p className="text-body text-ink-2">{t('none')}</p>}
      <ul className="flex flex-col gap-8">
        {exercises.map((exerciseSummary) => {
          const { slot, setsDone, volumeKg, topSet, records } = exerciseSummary
          const exercise = findExercise(slot.exerciseId, custom)
          const unit = units?.get(slot.exerciseId) ?? 'kg'
          const bodyweight = isBodyweight(exercise.equipment)
          const unitLabel = tWorkout(`unit.${unit}`)
          const setText = (set: WorkoutSet) => {
            const weight = formatSetWeight(set.weightKg, unit, bodyweight, tWorkout('bodyweight'))
            const withUnit = bodyweight && set.weightKg === 0 ? weight : `${weight} ${unitLabel}`
            return `${withUnit} × ${String(set.reps)}`
          }
          const topDeltaKg = comparison?.topWeightDeltaKg.get(slot.exerciseId) ?? 0
          return (
            <li key={slot.id} className="flex flex-col gap-8 rounded-group bg-surface p-16">
              <div className="flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-8">
                  <h2 className="text-body font-semibold text-ink">
                    {exerciseName(exercise, locale)}
                  </h2>
                  {topSet && (
                    <p className="shrink-0 text-label text-ink-3">
                      {t('top')} <span className="num text-body text-ink">{setText(topSet)}</span>
                    </p>
                  )}
                </div>
                <p className="text-label text-ink-3">
                  {t('exerciseLine', { sets: setsDone, volume: number.format(volumeKg) })}
                  {topDeltaKg !== 0 &&
                    ` · ${t('topDelta', {
                      delta: `${topDeltaKg > 0 ? '+' : '−'}${formatWeight(Math.abs(topDeltaKg), unit)} ${unitLabel}`,
                    })}`}
                </p>
              </div>
              {records.map(({ set, kinds }) => (
                <div key={set.id} className="flex flex-wrap items-center gap-8">
                  <span className="rounded-full bg-accent px-8 text-label font-semibold text-accent-ink">
                    {t('newRecord')}
                  </span>
                  <span className="num text-body text-ink">{setText(set)}</span>
                  <span className="text-label text-ink-2">
                    {kinds.map((kind) => recordText(kind, set, unit, unitLabel)).join(' · ')}
                  </span>
                </div>
              ))}
              {setList?.(exerciseSummary, setText)}
            </li>
          )
        })}
      </ul>
    </>
  )

  function recordText(
    kind: RecordKind,
    set: WorkoutSet,
    unit: WeightUnit,
    unitLabel: string,
  ): string {
    switch (kind) {
      case 'e1rm': {
        const e1rm = estimateOneRepMax(set.weightKg, set.reps) ?? set.weightKg
        return t('recordE1rm', { weight: `${formatWeight(e1rm, unit)} ${unitLabel}` })
      }
      case 'reps':
        return t('recordReps')
    }
  }
}
