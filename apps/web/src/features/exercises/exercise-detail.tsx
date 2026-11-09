'use client'

import { builtInExerciseCues } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'

import { formatRest, type LibraryEntry } from './library'
import { MuscleMap } from './muscle-map'
import { Pressable } from '@/ui/pressable'

// The detail of an exercise: where it works and how it is set up. A custom
// exercise has no mechanic or cues, and has an Edit button.
export function ExerciseDetail({
  exercise,
  onEdit,
}: {
  exercise: LibraryEntry
  onEdit: () => void
}) {
  const t = useTranslations('exerciseDetail')
  const tMuscle = useTranslations('muscle')
  const tEquipment = useTranslations('equipment')
  const locale = useLocale()
  const cues = builtInExerciseCues(exercise.id)?.[locale] ?? []
  const primary = tMuscle(exercise.muscle)
  const { secondaryMuscles } = exercise
  const secondary =
    secondaryMuscles.length > 0
      ? secondaryMuscles.map((muscle) => tMuscle(muscle)).join(t('separator'))
      : t('none')
  const rows = [
    { label: t('primary'), value: primary },
    { label: t('secondary'), value: secondary },
    { label: t('equipment'), value: tEquipment(exercise.equipment) },
    ...(exercise.custom ? [] : [{ label: t('mechanic'), value: t(exercise.mechanic) }]),
  ]

  return (
    <div className="flex flex-col gap-20">
      <div className="flex flex-col items-center gap-12 rounded-group bg-bg px-40 py-20">
        <div className="flex w-full flex-col gap-12">
          <MuscleMap
            primary={exercise.muscle}
            secondary={secondaryMuscles}
            label={t('mapLabel', { primary, secondary })}
          />
          <p className="flex justify-around text-label text-ink-3" aria-hidden>
            <span>{t('front')}</span>
            <span>{t('back')}</span>
          </p>
        </div>
      </div>
      {cues.length > 0 && (
        <section className="flex flex-col gap-8" aria-label={t('cues')}>
          <h3 className="text-label text-ink-3">{t('cues')}</h3>
          <ol className="flex flex-col gap-8">
            {cues.map((cue, index) => (
              <li key={cue} className="flex gap-12 text-body text-ink">
                <span className="num pt-4 text-label text-ink-3" aria-hidden>
                  {(index + 1).toString()}
                </span>
                {cue}
              </li>
            ))}
          </ol>
        </section>
      )}
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
      {exercise.custom && (
        <Pressable
          onClick={onEdit}
          className="rounded-full bg-sunk px-20 py-16 font-semibold text-ink"
        >
          {t('edit')}
        </Pressable>
      )}
    </div>
  )
}
