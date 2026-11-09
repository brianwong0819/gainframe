'use client'

import type { Exercise } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { db, planStore, workoutSession } from '@/db/client'
import type { UpNext } from '@/db/plans'
import { useLiveQuery } from '@/db/use-live-query'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

import { exerciseName } from '../exercises/library'
import { findExercise } from '../workout/exercise-info'

const loadUpNext = () => planStore.upNext()
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()

// The active plan's next day; null without one, undefined while loading.
export function useUpNext(): UpNext | null | undefined {
  return useLiveQuery(loadUpNext)
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

// Today's day of the active plan with its exercises and the button to start it.
// The user can pick another day of the plan instead, or start an empty workout.
export function UpNextCard({ upNext }: { upNext: UpNext }) {
  const t = useTranslations('plans')
  const locale = useLocale()
  const router = useRouter()
  const custom = useLiveQuery(allCustomExercises) ?? []
  const [picking, setPicking] = useState(false)
  const { plan, day, n, days, items } = upNext

  const start = (write: Promise<unknown>) => {
    void write.then(() => {
      router.push('/workout/session')
    })
  }
  const startDay = (dayId: string) => {
    start(workoutSession.startFromPlanDay(dayId, timeZone()))
  }

  return (
    <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
      <p className="text-label text-ink-3">
        {t('upNext', { n, count: days.length, plan: plan.name })}
      </p>
      <h2 className="text-section">{day.name}</h2>
      <p className="text-label text-ink-2">
        {items.length === 0
          ? t('noItems')
          : items
              .map((item) => exerciseName(findExercise(item.exerciseId, custom), locale))
              .join(' · ')}
      </p>
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
            start(workoutSession.start(timeZone()))
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
