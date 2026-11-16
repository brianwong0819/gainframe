'use client'

import type { Exercise, RecentRecord } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'

import { weightUnits } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'

import { exerciseName } from '../exercises/library'
import { formatDay } from '../history/dates'
import { findExercise, formatSetWeight, isBodyweight } from './exercise-info'

const loadWeightUnits = () => weightUnits.all()

// The latest record of each exercise: its name and day, and the set in the
// number face with the unit set small beside it.
export function RecentRecords({
  records,
  custom,
}: {
  records: readonly RecentRecord[]
  custom: readonly Exercise[]
}) {
  const t = useTranslations('today')
  const tWorkout = useTranslations('workout')
  const locale = useLocale()
  const units = useLiveQuery(loadWeightUnits)
  if (records.length === 0) return null
  return (
    <section className="flex flex-col rounded-group bg-surface px-16 pt-16">
      <h2 className="text-label text-ink-3">{t('records')}</h2>
      <ul>
        {records.map(({ set, workout }) => {
          const exercise = findExercise(set.exerciseId, custom)
          const unit = units?.get(set.exerciseId) ?? 'kg'
          const bodyweight = isBodyweight(exercise.equipment)
          return (
            <li
              key={set.id}
              className="flex items-center justify-between gap-12 border-t border-line py-12 first:border-t-0"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body text-ink">
                  {exerciseName(exercise, locale)}
                </span>
                <span className="text-label text-ink-3">
                  {formatDay(workout.localDate, locale)}
                </span>
              </span>
              <span className="shrink-0 text-label text-ink-3">
                <span className="num text-body font-semibold text-ink">
                  {formatSetWeight(set.weightKg, unit, bodyweight, tWorkout('bodyweight'))}
                </span>
                {!(bodyweight && set.weightKg === 0) && ` ${tWorkout(`unit.${unit}`)}`}
                {' × '}
                <span className="num text-body font-semibold text-ink">{set.reps}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
