'use client'

import { addDays, type LocalDate, toLocalDate } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'

import { db } from '@/db/client'
import { foodDay } from '@/db/food'
import { currentProfile } from '@/db/profile'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'
import { Chevron } from '@/ui/chevron'
import { Pressable } from '@/ui/pressable'

import { formatDay } from '../history/dates'
import { DayCard } from './day-card'
import { MealList } from './meal-list'
import { TargetsSheet } from './targets-sheet'

const readTargets = () =>
  currentProfile(db).then((profile) =>
    profile === undefined ? null : { proteinG: profile.proteinValue, kcal: profile.kcalTarget },
  )

// The Food tab: one day's protein and energy against the targets and its
// meals. The header steps between days; the next day stops at today.
export function FoodScreen() {
  const t = useTranslations('food')
  const locale = useLocale()
  const [today] = useState(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const [date, setDate] = useState<LocalDate>(today)
  const readDay = useCallback(() => foodDay(db, date), [date])
  const day = useLiveQuery(readDay)
  const targets = useLiveQuery(readTargets)
  const [editingTargets, setEditingTargets] = useState(false)
  const step = (days: number) => {
    setDate((current) => addDays(current, days))
  }
  const dayButton = (days: -1 | 1, label: string, disabled: boolean) => (
    <Pressable
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        step(days)
      }}
      className="p-4 text-ink disabled:text-ink-3"
    >
      <span className="flex size-40 items-center justify-center rounded-full bg-surface">
        <Chevron direction={days === -1 ? 'left' : 'right'} />
      </span>
    </Pressable>
  )
  return (
    <main className="flex flex-col gap-20">
      <header className="flex items-center justify-between gap-12">
        <div className="flex flex-col gap-4">
          <h1 className="text-title">{t('title')}</h1>
          <p className="text-label text-ink-3">
            {date === today ? t('today') : formatDay(date, locale)}
          </p>
        </div>
        <div className="flex">
          {dayButton(-1, t('previousDay'), false)}
          {dayButton(1, t('nextDay'), date >= today)}
        </div>
      </header>
      {day !== undefined && targets !== undefined && (
        <>
          <DayCard
            meals={day.meals}
            totals={day.totals}
            targets={targets}
            onEditTargets={() => {
              setEditingTargets(true)
            }}
          />
          {day.meals.length === 0 ? (
            <p className="text-body text-ink-2">{date === today ? t('empty') : t('emptyDay')}</p>
          ) : (
            <MealList meals={day.meals} />
          )}
          <TargetsSheet
            open={editingTargets}
            onClose={() => {
              setEditingTargets(false)
            }}
            targets={targets}
          />
        </>
      )}
    </main>
  )
}
