'use client'

import {
  estimateOneRepMax,
  type Exercise,
  type RecordKind,
  type WeightUnit,
  type WorkoutSet,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'

import { db, weightUnits } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import type { WorkoutSummaryState } from '@/db/workout-summary'

import { exerciseName } from '../exercises/library'
import { findExercise, formatSetWeight, formatWeight, isBodyweight } from './exercise-info'

// Custom exercises including deleted ones, so names never go missing.
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()
const loadWeightUnits = () => weightUnits.all()

// What a workout added up to: the figures first, then each exercise with its
// top set and records. Shown when a workout ends; history (M1-10) reuses it.
export function WorkoutSummaryView({ state }: { state: WorkoutSummaryState }) {
  const t = useTranslations('summary')
  const tWorkout = useTranslations('workout')
  const locale = useLocale()
  const custom = useLiveQuery(allCustomExercises) ?? []
  const units = useLiveQuery(loadWeightUnits)
  const { summary } = state
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })

  const minutes = Math.round((summary.durationS ?? 0) / 60)
  const duration =
    minutes >= 60
      ? t('hours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
      : t('minutes', { minutes })
  const figures = [
    { label: t('duration'), value: duration },
    { label: t('volume'), value: `${number.format(summary.volumeKg)} ${tWorkout('unit.kg')}` },
    { label: t('sets'), value: String(summary.setsDone) },
    { label: t('records'), value: String(summary.recordCount) },
  ]

  const exercises = summary.exercises.filter(({ setsDone }) => setsDone > 0)
  return (
    <>
      <dl className="grid grid-cols-2 gap-8">
        {figures.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-4 rounded-group bg-surface p-16">
            <dt className="text-label text-ink-3">{label}</dt>
            <dd className="num text-section text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {exercises.length === 0 && <p className="text-body text-ink-2">{t('none')}</p>}
      <ul className="flex flex-col gap-8">
        {exercises.map(({ slot, setsDone, volumeKg, topSet, records }) => {
          const exercise = findExercise(slot.exerciseId, custom)
          const unit = units?.get(slot.exerciseId) ?? 'kg'
          const bodyweight = isBodyweight(exercise.equipment)
          const unitLabel = tWorkout(`unit.${unit}`)
          const setText = (set: WorkoutSet) => {
            const weight = formatSetWeight(set.weightKg, unit, bodyweight, tWorkout('bodyweight'))
            const withUnit = bodyweight && set.weightKg === 0 ? weight : `${weight} ${unitLabel}`
            return `${withUnit} × ${String(set.reps)}`
          }
          return (
            <li key={slot.id} className="flex flex-col gap-8 rounded-group bg-surface p-16">
              <div className="flex flex-col gap-4">
                <h2 className="text-body font-semibold text-ink">
                  {exerciseName(exercise, locale)}
                </h2>
                <p className="text-label text-ink-3">
                  {t('exerciseLine', { sets: setsDone, volume: number.format(volumeKg) })}
                  {topSet && ` · ${t('top', { set: setText(topSet) })}`}
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
