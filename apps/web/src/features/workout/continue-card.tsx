'use client'

import type { Exercise } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'

import type { ActiveWorkoutState } from '@/db/workout-session'
import { PressableLink } from '@/ui/pressable'

import { exerciseName } from '../exercises/library'
import { selectedSet } from './active-workout'
import { formatClock } from './clock'
import { findExercise } from './exercise-info'
import { SetProgress, useElapsedS, useWorkoutDay } from './session-header'

// The workout in progress on the Workout tab: what is being done, for how
// long, how far along it is and the set that comes next. The whole card leads
// back to it.
export function ContinueCard({
  state,
  custom,
}: {
  state: ActiveWorkoutState
  custom: readonly Exercise[]
}) {
  const t = useTranslations('workout')
  const locale = useLocale()
  const elapsedS = useElapsedS(state.workout.startedAt)
  const day = useWorkoutDay(state.workout.planDayId)
  const sets = state.slots.flatMap((slot) => slot.sets)
  const done = sets.filter((set) => set.completedAt !== null).length
  const next = selectedSet(state, null)
  return (
    <PressableLink
      href="/workout/session"
      className="flex flex-col gap-12 rounded-group border-2 border-accent-soft bg-surface p-16"
    >
      <span className="flex items-center justify-between gap-12">
        <span className="text-label font-semibold text-accent">{t('active')}</span>
        <span className="num text-body font-semibold text-ink" role="timer">
          {formatClock(elapsedS)}
        </span>
      </span>
      <span className="flex flex-col gap-4">
        {day?.dayName != null && <span className="truncate text-section">{day.dayName}</span>}
        <span className="truncate text-label text-ink-2">
          {next
            ? t('nextSet', {
                name: exerciseName(findExercise(next.exerciseId, custom), locale),
                n: next.n,
              })
            : t('progress', { exercises: state.slots.length, done })}
        </span>
      </span>
      <SetProgress done={done} total={sets.length} />
      <span className="rounded-ctl bg-accent py-12 text-center text-body font-semibold text-accent-ink">
        {t('continue')}
      </span>
    </PressableLink>
  )
}
