'use client'

import type { Exercise, WorkoutSummaryEntry } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { db, planStore, workoutSession } from '@/db/client'
import { deviceTimeZone } from '@/i18n/time-zone'
import type { UpNext } from '@/db/plans'
import { useLiveQuery } from '@/db/use-live-query'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

import { exerciseName } from '../exercises/library'
import { formatDay } from '../history/dates'
import { useDurationText } from '../workout/duration'
import { findExercise } from '../workout/exercise-info'
import { estimateDayS } from './estimate'

const loadUpNext = () => planStore.upNext()
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()

// The active plan's next day; null without one, undefined while loading.
export function useUpNext(): UpNext | null | undefined {
  return useLiveQuery(loadUpNext)
}

// Today's day of the active plan with its exercises, a rough length, what the
// day came to the last time it was done (`last`, null if never) and the button
// to start it. The user can pick another day of the plan instead, or start an
// empty workout.
export function UpNextCard({ upNext, last }: { upNext: UpNext; last: WorkoutSummaryEntry | null }) {
  const t = useTranslations('plans')
  const tWorkout = useTranslations('workout')
  const duration = useDurationText()
  const locale = useLocale()
  const router = useRouter()
  const custom = useLiveQuery(allCustomExercises) ?? []
  const [picking, setPicking] = useState(false)
  const { plan, day, n, days, items } = upNext
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const estimateS = estimateDayS(items, custom)

  const start = (write: Promise<unknown>) => {
    void write.then(() => {
      router.push('/workout/session')
    })
  }
  const startDay = (dayId: string) => {
    start(workoutSession.startFromPlanDay(dayId, deviceTimeZone()))
  }

  return (
    <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
      <div className="flex items-baseline justify-between gap-12 text-label text-ink-3">
        <p className="min-w-0 truncate">
          {t('upNext', { n, count: days.length, plan: plan.name })}
        </p>
        {estimateS > 0 && (
          <p className="shrink-0">{t('estimate', { duration: duration(estimateS) })}</p>
        )}
      </div>
      <h2 className="text-section">{day.name}</h2>
      <p className="text-label text-ink-2">
        {items.length === 0
          ? t('noItems')
          : items
              .map((item) => exerciseName(findExercise(item.exerciseId, custom), locale))
              .join(' · ')}
      </p>
      {last && (
        <p className="flex items-baseline justify-between gap-12 rounded-ctl bg-bg px-12 py-8 text-label text-ink-3">
          <span className="min-w-0 truncate">
            {t('lastTime', { date: formatDay(last.workout.localDate, locale) })}
          </span>
          <span className="shrink-0 text-ink-2">
            {duration(last.summary.durationS ?? 0)}
            {' · '}
            <span className="num">{number.format(last.summary.volumeKg)}</span>{' '}
            {tWorkout('unit.kg')}
          </span>
        </p>
      )}
      <Pressable
        onClick={() => {
          startDay(day.id)
        }}
        className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
      >
        {t('startDay', { day: day.name })}
      </Pressable>
      <div className="flex flex-wrap gap-8">
        {days.length > 1 && (
          <Pressable
            onClick={() => {
              setPicking(true)
            }}
            className="rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
          >
            {t('otherDay')}
          </Pressable>
        )}
        <Pressable
          onClick={() => {
            start(workoutSession.start(deviceTimeZone()))
          }}
          className="rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
        >
          {t('emptyWorkout')}
        </Pressable>
      </div>
      <Sheet
        open={picking}
        onClose={() => {
          setPicking(false)
        }}
        closeLabel={t('close')}
        title={t('pickDay')}
      >
        <ul>
          {days.map((other, index) => (
            <li key={other.id} className="border-t border-line first:border-t-0">
              <Pressable
                onClick={() => {
                  setPicking(false)
                  startDay(other.id)
                }}
                className="flex w-full flex-col py-12 text-left"
              >
                <span className="text-body text-ink">{other.name}</span>
                <span className="text-label text-ink-3">
                  {t('dayOf', { n: index + 1, count: days.length })}
                  {other.id === day.id && ` · ${t('nextUp')}`}
                </span>
              </Pressable>
            </li>
          ))}
        </ul>
      </Sheet>
    </section>
  )
}
