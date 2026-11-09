'use client'

import { domainConfig, type WorkoutSet } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'

import { repositories } from '@/db/client'
import { Pressable } from '@/ui/pressable'
import { Stepper } from '@/ui/stepper'

import { exerciseName } from '../exercises/library'
import { type ExerciseInfo, formatKg, isBodyweight } from './exercise-info'

interface SetPanelProps {
  set: WorkoutSet
  n: number
  exercise: ExerciseInfo
  onComplete: () => void
}

// The selected set's weight and reps, with big steppers and the complete
// button in the thumb zone. Every tap is written to the device database.
export function SetPanel({ set, n, exercise, onComplete }: SetPanelProps) {
  const t = useTranslations('workout')
  const locale = useLocale()
  const step = domainConfig.weightStepKg[exercise.equipment]
  const bodyweight = isBodyweight(exercise.equipment)

  function save(changes: Partial<Pick<WorkoutSet, 'weightKg' | 'reps'>>) {
    void repositories.workoutSets.update(set.id, changes)
  }

  return (
    <div className="set-panel flex flex-col gap-12 rounded-group bg-surface p-16">
      <p className="text-label text-ink-2">
        {exerciseName(exercise, locale)} · {t('colSet')} {n}
      </p>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-12 gap-y-8">
        <span className="text-label text-ink-3">{bodyweight ? t('colLoad') : t('colWeight')}</span>
        <Stepper
          value={bodyweight && set.weightKg === 0 ? t('bodyweight') : formatKg(set.weightKg)}
          canDecrease={set.weightKg > 0}
          decreaseLabel={t('weightDown', { n })}
          increaseLabel={t('weightUp', { n })}
          onStep={(direction) => {
            save({
              weightKg: Math.max(0, Math.round((set.weightKg + direction * step) * 100) / 100),
            })
          }}
        />
        <span className="text-label text-ink-3">{t('colReps')}</span>
        <Stepper
          value={String(set.reps)}
          canDecrease={set.reps > 0}
          decreaseLabel={t('repsDown', { n })}
          increaseLabel={t('repsUp', { n })}
          onStep={(direction) => {
            save({ reps: Math.max(0, set.reps + direction) })
          }}
        />
      </div>
      <Pressable
        onClick={onComplete}
        className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
      >
        {t('complete', { n })}
      </Pressable>
    </div>
  )
}
