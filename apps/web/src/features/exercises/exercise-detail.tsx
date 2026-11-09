'use client'

import type { BuiltInExercise } from '@gainframe/shared'
import { useTranslations } from 'next-intl'

import { formatRest } from './library'
import { MuscleMap } from './muscle-map'

// The detail of a built-in exercise: where it works and how it is set up.
export function ExerciseDetail({ exercise }: { exercise: BuiltInExercise }) {
  const t = useTranslations('exerciseDetail')
  const tMuscle = useTranslations('muscle')
  const tEquipment = useTranslations('equipment')
  const primary = tMuscle(exercise.muscle)
  const secondary =
    exercise.secondaryMuscles.length > 0
      ? exercise.secondaryMuscles.map((muscle) => tMuscle(muscle)).join(t('separator'))
      : t('none')
  const rows = [
    { label: t('primary'), value: primary },
    { label: t('secondary'), value: secondary },
    { label: t('equipment'), value: tEquipment(exercise.equipment) },
    { label: t('mechanic'), value: t(exercise.mechanic) },
  ]

  return (
    <div className="flex flex-col gap-20">
      <div className="flex flex-col items-center gap-12 rounded-group bg-bg px-40 py-20">
        <div className="flex w-full flex-col gap-12">
          <MuscleMap
            primary={exercise.muscle}
            secondary={exercise.secondaryMuscles}
            label={t('mapLabel', { primary, secondary })}
          />
          <p className="flex justify-around text-label text-ink-3" aria-hidden>
            <span>{t('front')}</span>
            <span>{t('back')}</span>
          </p>
        </div>
      </div>
      <dl className="flex flex-col">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-12 border-t border-line py-12 first:border-t-0"
          >
            <dt className="text-label text-ink-2">{label}</dt>
            <dd className="text-right text-body text-ink">{value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-12 border-t border-line py-12">
          <dt className="text-label text-ink-2">{t('rest')}</dt>
          <dd className="num text-body text-ink">{formatRest(exercise.defaultRestS)}</dd>
        </div>
      </dl>
    </div>
  )
}
