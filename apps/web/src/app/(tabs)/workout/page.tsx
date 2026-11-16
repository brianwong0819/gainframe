'use client'

import {
  BUILT_IN_EXERCISES,
  type Exercise,
  lastOfPlanDay,
  summarizeWeek,
  toLocalDate,
} from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { db, planStore, workoutSession } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { countHistory, loadWorkoutHistory } from '@/db/workout-history'
import { deviceTimeZone } from '@/i18n/time-zone'
import { UpNextCard, useUpNext } from '@/features/plans/up-next-card'
import { useActiveWorkout } from '@/features/workout/active-workout'
import { ContinueCard } from '@/features/workout/continue-card'
import { WeekCard } from '@/features/workout/week-card'
import { Chevron } from '@/ui/chevron'
import { Pressable, PressableLink } from '@/ui/pressable'

import { TabScreen } from '../tab-screen'

const loadActivePlan = () => planStore.activePlan()
const countFinished = () => countHistory(db)

const loadHistory = () => loadWorkoutHistory(db)
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()
const noExercises: Exercise[] = []

const linkRowClass = 'flex items-center justify-between gap-12 py-16'
const linkDetailClass = 'flex min-w-0 items-center gap-8 text-label text-ink-3'

export default function WorkoutPage() {
  const t = useTranslations('workout')
  const router = useRouter()
  const active = useActiveWorkout()
  const history = useLiveQuery(loadHistory)
  const custom = useLiveQuery(allCustomExercises) ?? noExercises
  const [today] = useState(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const activePlan = useLiveQuery(loadActivePlan)
  const upNext = useUpNext()
  const finished = useLiveQuery(countFinished)

  // The cards wait for the workout in progress, the plan's next day and the
  // history to load: the cards above them appear only then, and would push them
  // down under a finger mid-tap.
  if (active === undefined || upNext === undefined || history === undefined) {
    return <TabScreen title={t('title')} />
  }
  return (
    <TabScreen title={t('title')}>
      {active && <ContinueCard state={active} custom={custom} />}
      {history.length > 0 && <WeekCard week={summarizeWeek(history, today)} today={today} />}
      {active === null && upNext && (
        <UpNextCard upNext={upNext} last={lastOfPlanDay(history, upNext.day.id)} />
      )}
      {active === null && upNext === null && (
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
      )}
      <nav className="flex flex-col rounded-group bg-surface px-16">
        <PressableLink href="/workout/plans" className={linkRowClass}>
          <span className="shrink-0 text-body text-ink">{t('plans')}</span>
          <span className={linkDetailClass}>
            <span className="truncate">{activePlan ? activePlan.name : t('plansNone')}</span>
            <Chevron direction="right" />
          </span>
        </PressableLink>
        <PressableLink href="/workout/history" className={`${linkRowClass} border-t border-line`}>
          <span className="shrink-0 text-body text-ink">{t('history')}</span>
          <span className={linkDetailClass}>
            {finished !== undefined && (
              <span className="truncate">
                {finished > 0 ? t('historyCount', { count: finished }) : t('historyNone')}
              </span>
            )}
            <Chevron direction="right" />
          </span>
        </PressableLink>
        <PressableLink href="/workout/exercises" className={`${linkRowClass} border-t border-line`}>
          <span className="shrink-0 text-body text-ink">{t('library')}</span>
          <span className={linkDetailClass}>
            <span className="truncate">
              {t('libraryCount', { count: BUILT_IN_EXERCISES.length })}
            </span>
            <Chevron direction="right" />
          </span>
        </PressableLink>
      </nav>
    </TabScreen>
  )
}
