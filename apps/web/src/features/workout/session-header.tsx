'use client'

import type { Workout } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { BackLink } from '@/ui/back-link'
import { Pressable } from '@/ui/pressable'
import { Verdict } from '@/ui/verdict'

import { formatClock } from './clock'

const TICK_MS = 1000

// Seconds since the workout started, redrawn every second and on each return
// to the page (iOS pauses timers while the app is hidden).
export function useElapsedS(startedAt: string): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => {
      setNow(Date.now())
    }
    const timer = setInterval(tick, TICK_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return (now - Date.parse(startedAt)) / 1000
}

// The plan day a workout was started from and its plan; both null for a
// workout started empty, undefined while loading.
export function useWorkoutDay(planDayId: string | null) {
  const loadDay = useMemo(
    () => async () => {
      const day = planDayId === null ? undefined : await db.planDays.get(planDayId)
      const plan = day === undefined ? undefined : await db.plans.get(day.planId)
      return { dayName: day?.name ?? null, planName: plan?.name ?? null }
    },
    [planDayId],
  )
  return useLiveQuery(loadDay)
}

// One segment per set, filled as sets are completed, with the count beside it.
export function SetProgress({ done, total }: { done: number; total: number }) {
  const t = useTranslations('workout')
  if (total === 0) return null
  return (
    <div className="flex items-center gap-12">
      <div className="flex flex-1 gap-4" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-4 flex-1 rounded-full ${index < done ? 'bg-accent' : 'bg-sunk'}`}
          />
        ))}
      </div>
      <p className="text-label text-ink-2">
        <span className="num">
          {done}/{total}
        </span>{' '}
        {t('setsUnit')}
      </p>
    </div>
  )
}

interface SessionHeaderProps {
  workout: Workout
  // Completed sets out of all sets of the workout.
  done: number
  total: number
  // The estimated time the sets still to do take, with their rests.
  remainingS: number
  onFinish: () => void
}

// The top of the workout in progress: the way back and the finish button, the
// plan day being done (or "Workout" for one started empty), the time since it
// started with a verdict line of the sets left and about how long they take,
// and one segment per set, filled as sets are completed.
export function SessionHeader({ workout, done, total, remainingS, onFinish }: SessionHeaderProps) {
  const t = useTranslations('workout')
  const elapsedS = useElapsedS(workout.startedAt)
  const day = useWorkoutDay(workout.planDayId)

  return (
    <header className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-12">
        <BackLink href="/workout" label={t('title')} />
        <Pressable
          onClick={onFinish}
          className="rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
        >
          {t('finish')}
        </Pressable>
      </div>
      <div className="flex items-end justify-between gap-12">
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="truncate text-title">{day?.dayName ?? t('active')}</h1>
          {day?.planName != null && (
            <p className="truncate text-label text-ink-3">{day.planName}</p>
          )}
        </div>
        <p className="flex shrink-0 flex-col items-end">
          <span className="num text-section" role="timer">
            {formatClock(elapsedS)}
          </span>
          <span className="text-label text-ink-3">{t('elapsed')}</span>
        </p>
      </div>
      {done < total && (
        <Verdict
          tone="ok"
          word={t('remainingSets', { count: total - done })}
          className="justify-end"
        >
          {t('remainingTime', { minutes: Math.max(1, Math.round(remainingS / 60)) })}
        </Verdict>
      )}
      <SetProgress done={done} total={total} />
    </header>
  )
}
