'use client'

import type { WeightUnit, WorkoutSet } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'

import { Pressable } from '@/ui/pressable'

import { exerciseName } from '../exercises/library'
import { type ExerciseInfo, formatSetWeight, isBodyweight } from './exercise-info'
import { SetFields } from './set-fields'

interface SetPanelProps {
  set: WorkoutSet
  n: number
  // How many sets the exercise has, for "set 2/3".
  of: number
  exerciseId: string
  exercise: ExerciseInfo
  // The exercise's place in its superset ("A1"); null when it stands alone.
  supersetLabel: string | null
  unit: WeightUnit
  onDetails: () => void
  // Completes the set; the caller also starts the rest after it.
  // The tapped button, where the celebration starts.
  onComplete: (anchor: Element) => void
}

// The selected set's weight and reps (`SetFields`), with the complete button
// in the thumb zone. The button spells out what it will log ("62.5 kg × 8").
export function SetPanel({
  set,
  n,
  of,
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
  const weight = formatSetWeight(
    set.weightKg,
    unit,
    isBodyweight(exercise.equipment),
    t('bodyweight'),
  )

  return (
    <div className="set-panel dock-panel flex flex-col gap-12 rounded-group bg-surface p-16">
      <div className="flex items-center justify-between gap-12">
        <p className="min-w-0 truncate text-label font-semibold text-accent">
          {supersetLabel !== null && `${supersetLabel} · `}
          {exerciseName(exercise, locale)} · {t('colSet')} {n}/{of}
          {set.kind !== 'working' && ` · ${tKind(set.kind)}`}
        </p>
        <Pressable
          onClick={onDetails}
          className="shrink-0 rounded-full bg-sunk px-12 py-8 text-label font-semibold text-ink"
        >
          {t('details')}
        </Pressable>
      </div>
      <SetFields set={set} n={n} exerciseId={exerciseId} exercise={exercise} unit={unit} />
      <Pressable
        onClick={(event) => {
          onComplete(event.currentTarget)
        }}
        aria-label={t('complete', { n })}
        className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
      >
        {t('completeValues')}
        <span className="num">
          {' · '}
          {weight}
          {set.weightKg > 0 && ` ${t(`unit.${unit}`)}`} × {set.reps}
        </span>
      </Pressable>
    </div>
  )
}
