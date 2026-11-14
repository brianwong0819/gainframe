'use client'

import { domainConfig, type WeightUnit, weightUnitSchema, type WorkoutSet } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'

import { repositories, weightUnits, workoutSession } from '@/db/client'
import { Pressable } from '@/ui/pressable'
import { Stepper } from '@/ui/stepper'

import { exerciseName } from '../exercises/library'
import { parseReps, parseWeight } from './entry'
import { type ExerciseInfo, formatWeight, isBodyweight } from './exercise-info'

interface SetPanelProps {
  set: WorkoutSet
  n: number
  exerciseId: string
  exercise: ExerciseInfo
  // The exercise's place in its superset ("A1"); null when it stands alone.
  supersetLabel: string | null
  unit: WeightUnit
  onDetails: () => void
  // Completes the set; the caller also starts the rest after it.
  onComplete: () => void
}

// The selected set's weight and reps, with big steppers and the complete
// button in the thumb zone. Every tap is written to the device database. The
// weight is shown and typed in the exercise's unit; tapping the weight label
// switches it between kg and lb for this exercise, and a weight in pounds shows
// its kg beneath.
export function SetPanel({
  set,
  n,
  exerciseId,
  exercise,
  supersetLabel,
  unit,
  onDetails,
  onComplete,
}: SetPanelProps) {
  const t = useTranslations('workout')
  const tKind = useTranslations('setKind')
  const locale = useLocale()
  const step = (unit === 'kg' ? domainConfig.weightStepKg : domainConfig.weightStepLb)[
    exercise.equipment
  ]
  const bodyweight = isBodyweight(exercise.equipment)
  const bodyweightOnly = bodyweight && set.weightKg === 0
  const otherUnit = unit === 'kg' ? 'lb' : 'kg'

  return (
    <div className="set-panel flex flex-col gap-12 rounded-group bg-surface p-16">
      <div className="flex items-center justify-between gap-12">
        <p className="min-w-0 truncate text-label text-ink-2">
          {supersetLabel !== null && `${supersetLabel} · `}
          {exerciseName(exercise, locale)} · {t('colSet')} {n}
          {set.kind !== 'working' && ` · ${tKind(set.kind)}`}
        </p>
        <Pressable
          onClick={onDetails}
          className="shrink-0 rounded-full bg-sunk px-12 py-8 text-label font-semibold text-ink"
        >
          {t('details')}
        </Pressable>
      </div>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-12 gap-y-8">
        <Pressable
          onClick={() => {
            void weightUnits.set(exerciseId, otherUnit)
          }}
          aria-label={t('unitSwitch', { unit: t(`unit.${otherUnit}`) })}
          className="flex flex-col items-start gap-4 py-8 text-label"
        >
          <span className="text-ink-3">{bodyweight ? t('colLoad') : t('colWeight')}</span>
          <span className="flex rounded-full bg-sunk p-4" aria-hidden>
            {weightUnitSchema.options.map((option) => (
              <span
                key={option}
                className={`rounded-full px-8 py-4 ${option === unit ? 'bg-ink font-semibold text-bg' : 'text-ink-3'}`}
              >
                {t(`unit.${option}`)}
              </span>
            ))}
          </span>
        </Pressable>
        <Stepper
          value={bodyweightOnly ? t('bodyweight') : formatWeight(set.weightKg, unit)}
          editValue={bodyweightOnly ? '' : formatWeight(set.weightKg, unit)}
          inputMode="decimal"
          label={t('weightLabel', { n })}
          onEnter={(text) => {
            const weightKg = parseWeight(text === '' && bodyweight ? '0' : text, unit)
            if (weightKg !== null) void repositories.workoutSets.update(set.id, { weightKg })
          }}
          canDecrease={set.weightKg > 0}
          decreaseLabel={t('weightDown', { n })}
          increaseLabel={t('weightUp', { n })}
          onStep={(direction) => {
            void workoutSession.stepWeight(set.id, step, direction, unit)
          }}
        />
        {unit === 'lb' && set.weightKg > 0 && (
          <p className="num col-start-2 -mt-4 text-center text-label text-ink-3">
            {t('inKg', { weight: formatWeight(set.weightKg, 'kg') })}
          </p>
        )}
        <span className="text-label text-ink-3">{t('colReps')}</span>
        <Stepper
          value={String(set.reps)}
          editValue={String(set.reps)}
          inputMode="numeric"
          label={t('repsLabel', { n })}
          onEnter={(text) => {
            const reps = parseReps(text)
            if (reps !== null) void repositories.workoutSets.update(set.id, { reps })
          }}
          canDecrease={set.reps > 0}
          decreaseLabel={t('repsDown', { n })}
          increaseLabel={t('repsUp', { n })}
          onStep={(direction) => {
            void workoutSession.stepReps(set.id, direction)
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
