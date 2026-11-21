'use client'

import { domainConfig, type WeightUnit, weightUnitSchema, type WorkoutSet } from '@gainframe/shared'
import { useTranslations } from 'next-intl'

import { repositories, weightUnits, workoutSession } from '@/db/client'
import { Pressable } from '@/ui/pressable'
import { Stepper } from '@/ui/stepper'

import { parseReps, parseWeight } from './entry'
import { type ExerciseInfo, formatWeight, isBodyweight } from './exercise-info'

interface SetFieldsProps {
  set: WorkoutSet
  n: number
  exerciseId: string
  exercise: ExerciseInfo
  unit: WeightUnit
  // The plan's rep range ("12–15"), shown under the reps label; null without one.
  repRange?: string | null
}

// A set's weight and reps with big steppers, for the set panel of the workout
// in progress and for editing a set in history. Every tap is written to the
// device database. The weight is shown and typed in the exercise's unit;
// tapping the weight label, which names both units with the current one in ink,
// switches it between kg and lb for this exercise,
// and a weight in pounds shows its kg beneath.
export function SetFields({ set, n, exerciseId, exercise, unit, repRange = null }: SetFieldsProps) {
  const t = useTranslations('workout')
  const step = (unit === 'kg' ? domainConfig.weightStepKg : domainConfig.weightStepLb)[
    exercise.equipment
  ]
  const bodyweight = isBodyweight(exercise.equipment)
  const bodyweightOnly = bodyweight && set.weightKg === 0
  const otherUnit = unit === 'kg' ? 'lb' : 'kg'

  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-12 gap-y-8">
      <Pressable
        onClick={() => {
          void weightUnits.set(exerciseId, otherUnit)
        }}
        aria-label={t('unitSwitch', { unit: t(`unit.${otherUnit}`) })}
        className="flex flex-col items-start py-4 text-label"
      >
        <span className="text-ink-3">{bodyweight ? t('colLoad') : t('colWeight')}</span>
        <span className="flex gap-4" aria-hidden>
          {weightUnitSchema.options.map((option) => (
            <span
              key={option}
              className={option === unit ? 'font-semibold text-ink' : 'text-ink-3'}
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
      <span className="flex flex-col items-start py-4 text-label text-ink-3">
        {t('colReps')}
        {repRange !== null && <span className="num">{t('targetShort', { reps: repRange })}</span>}
      </span>
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
  )
}
