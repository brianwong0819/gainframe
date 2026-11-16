'use client'

import {
  type Exercise,
  lastOfPlanDay,
  type LocalDate,
  toLocalDate,
  type WorkoutSummaryEntry,
} from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { db, workoutSession } from '@/db/client'
import type { UpNext } from '@/db/plans'
import { useLiveQuery } from '@/db/use-live-query'
import { loadWorkoutHistory } from '@/db/workout-history'
import type { ActiveWorkoutState } from '@/db/workout-session'
import { deviceTimeZone } from '@/i18n/time-zone'
import { Pressable } from '@/ui/pressable'

import { UpNextCard, useUpNext } from '../plans/up-next-card'
import { useActiveWorkout } from './active-workout'
import { ContinueCard } from './continue-card'

const loadHistory = () => loadWorkoutHistory(db)
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()
const noExercises: Exercise[] = []

export interface WorkoutOverview {
  active: ActiveWorkoutState | null
  upNext: UpNext | null
  // Finished workouts, newest first.
  history: WorkoutSummaryEntry[]
  custom: Exercise[]
  today: LocalDate
}

// What the Today and Workout tabs lead with: the workout in progress, the
// plan's next day and the finished workouts. Undefined until all of it has
// loaded, so a card that appears late cannot push another under a finger
// mid-tap.
export function useWorkoutOverview(): WorkoutOverview | undefined {
  const active = useActiveWorkout()
  const upNext = useUpNext()
  const history = useLiveQuery(loadHistory)
  const custom = useLiveQuery(allCustomExercises) ?? noExercises
  const [today] = useState(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  if (active === undefined || upNext === undefined || history === undefined) return undefined
  return { active, upNext, history, custom, today }
}

// The one workout action of the moment: continue the workout in progress,
// start the plan's next day, or start an empty workout when there is no plan.
export function NextWorkout({ overview }: { overview: WorkoutOverview }) {
  const t = useTranslations('workout')
  const router = useRouter()
  const { active, upNext, history, custom } = overview
  if (active) return <ContinueCard state={active} custom={custom} />
  if (upNext) return <UpNextCard upNext={upNext} last={lastOfPlanDay(history, upNext.day.id)} />
  return (
    <Pressable
      onClick={() => {
        void workoutSession.start(deviceTimeZone()).then(() => {
          router.push('/workout/session')
        })
      }}
      className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
    >
      {t('start')}
    </Pressable>
  )
}
