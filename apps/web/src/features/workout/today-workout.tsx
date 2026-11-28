'use client'

import type { Exercise } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { db, workoutSession } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'
import { Pressable, PressableLink } from '@/ui/pressable'

import { estimateDayS } from '../plans/estimate'
import { formatClock } from './clock'
import { useDurationText } from './duration'
import type { WorkoutOverview } from './next-workout'
import { useElapsedS, useWorkoutDay } from './session-header'

const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()

const rowClass = 'flex items-center justify-between gap-12 rounded-group bg-surface p-16'
const buttonClass =
  'shrink-0 rounded-full bg-accent px-16 py-12 text-label font-semibold text-accent-ink'

// The Today tab's workout row: the day to do (or the one in progress) with its
// length and one button. The exercise list, the other days and the empty
// workout stay on the Workout tab, which leads with the full card.
export function TodayWorkout({ overview }: { overview: WorkoutOverview }) {
  const { active, upNext } = overview
  if (active)
    return <ActiveRow startedAt={active.workout.startedAt} dayId={active.workout.planDayId} />
  if (upNext) return <UpNextRow upNext={upNext} />
  return <EmptyRow />
}

function ActiveRow({ startedAt, dayId }: { startedAt: string; dayId: string | null }) {
  const t = useTranslations('workout')
  const elapsedS = useElapsedS(startedAt)
  const day = useWorkoutDay(dayId)
  return (
    <PressableLink href="/workout/session" className={rowClass}>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body font-semibold text-ink">
          {day?.dayName ?? t('active')}
        </span>
        <span className="num text-label text-ink-3" role="timer">
          {formatClock(elapsedS)}
        </span>
      </span>
      <span className={buttonClass}>{t('continue')}</span>
    </PressableLink>
  )
}

function UpNextRow({ upNext }: { upNext: NonNullable<WorkoutOverview['upNext']> }) {
  const t = useTranslations('plans')
  const duration = useDurationText()
  const router = useRouter()
  const custom = useLiveQuery(allCustomExercises) ?? []
  const { day, items } = upNext
  const estimateS = estimateDayS(items, custom)
  return (
    <section className={rowClass}>
      <div className="flex min-w-0 flex-col">
        <h2 className="truncate text-body font-semibold text-ink">{day.name}</h2>
        {estimateS > 0 && (
          <p className="text-label text-ink-3">
            {t('estimate', { duration: duration(estimateS) })}
          </p>
        )}
      </div>
      <Pressable
        aria-label={t('startDay', { day: day.name })}
        onClick={() => {
          void workoutSession.startFromPlanDay(day.id, deviceTimeZone()).then(() => {
            router.push('/workout/session')
          })
        }}
        className={buttonClass}
      >
        {t('startShort')}
      </Pressable>
    </section>
  )
}

function EmptyRow() {
  const t = useTranslations('workout')
  const tPlans = useTranslations('plans')
  const router = useRouter()
  return (
    <section className={rowClass}>
      <p className="min-w-0 text-body font-semibold text-ink">{tPlans('emptyWorkout')}</p>
      <Pressable
        onClick={() => {
          void workoutSession.start(deviceTimeZone()).then(() => {
            router.push('/workout/session')
          })
        }}
        className={buttonClass}
      >
        {t('start')}
      </Pressable>
    </section>
  )
}
