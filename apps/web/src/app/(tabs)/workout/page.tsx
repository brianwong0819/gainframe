'use client'

import { BUILT_IN_EXERCISES, summarizeWeek } from '@gainframe/shared'
import { useTranslations } from 'next-intl'

import { db, planStore } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { countHistory } from '@/db/workout-history'
import { NextWorkout, useWorkoutOverview } from '@/features/workout/next-workout'
import { WeekCard } from '@/features/workout/week-card'
import { Chevron } from '@/ui/chevron'
import { PressableLink } from '@/ui/pressable'

import { TabScreen } from '../tab-screen'

const loadActivePlan = () => planStore.activePlan()
const countFinished = () => countHistory(db)

const linkRowClass = 'flex items-center justify-between gap-12 py-16'
const linkDetailClass = 'flex min-w-0 items-center gap-8 text-label text-ink-3'

export default function WorkoutPage() {
  const t = useTranslations('workout')
  const overview = useWorkoutOverview()
  const activePlan = useLiveQuery(loadActivePlan)
  const finished = useLiveQuery(countFinished)

  if (overview === undefined) return <TabScreen title={t('title')} />
  const { active, history, today } = overview
  // The workout in progress leads; otherwise the week comes before the start card.
  const week = history.length > 0 && <WeekCard week={summarizeWeek(history, today)} today={today} />
  return (
    <TabScreen title={t('title')}>
      {!active && week}
      <NextWorkout overview={overview} />
      {active && week}
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
