'use client'

import { fillProteinGap, toLocalDate } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'

import { db } from '@/db/client'
import { foodDay, knownFoods } from '@/db/food'
import { currentProfile } from '@/db/profile'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'
import { Pressable, PressableLink } from '@/ui/pressable'

import { DayCard } from './day-card'
import { logPortion } from './frequent-foods'
import { TargetsSheet } from './targets-sheet'

const readTargets = () =>
  currentProfile(db).then((profile) =>
    profile === undefined ? null : { proteinG: profile.proteinValue, kcal: profile.kcalTarget },
  )
const readFoods = () => knownFoods(db, 'frequent')

// Today's protein card (option C in design-system.md, "Food logging"): the
// Food tab's day card, then, while protein is short, up to two frequent foods
// that fill the gap, each logged with one tap. After a workout today the
// heading names it, with the "From training" tag.
export function TodayProteinCard({ trainedDay }: { trainedDay: string | null | undefined }) {
  const t = useTranslations('food')
  const locale = useLocale()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const [today] = useState(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const readDay = useCallback(() => foodDay(db, today), [today])
  const day = useLiveQuery(readDay)
  const targets = useLiveQuery(readTargets)
  const foods = useLiveQuery(readFoods)
  const [editingTargets, setEditingTargets] = useState(false)
  if (day === undefined || targets === undefined || foods === undefined) return null

  const gap = targets === null ? 0 : targets.proteinG - day.totals.proteinG
  const fill = fillProteinGap(gap, foods)
  const sum = fill.reduce(
    (total, food) => ({ proteinG: total.proteinG + food.proteinG, kcal: total.kcal + food.kcal }),
    { proteinG: 0, kcal: 0 },
  )
  const heading =
    trainedDay === undefined ? undefined : (
      <div className="flex items-center gap-8">
        <h2 className="text-label text-ink-3">
          {trainedDay === null ? t('trainedToday') : t('trainedDay', { day: trainedDay })}
        </h2>
        <span className="rounded-full bg-accent-wash px-8 text-label text-accent">
          {t('fromTraining')}
        </span>
      </div>
    )
  return (
    <>
      <DayCard
        meals={day.meals}
        totals={day.totals}
        targets={targets}
        heading={heading}
        onEditTargets={() => {
          setEditingTargets(true)
        }}
      >
        {gap > 0 && fill.length > 0 && (
          <div className="flex flex-col gap-8 border-t border-line pt-12">
            <h3 className="text-label text-ink-3">{t('fillHeading')}</h3>
            <ul className="flex flex-col">
              {fill.map((food) => (
                <li key={food.name} className="flex items-center justify-between gap-12">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body text-ink">{food.name}</span>
                    <span className="num text-label text-ink-3">
                      <span className="text-accent">
                        {t('proteinShort', { value: whole.format(food.proteinG) })}
                      </span>
                      {' · '}
                      {t('kcalShort', { value: whole.format(food.kcal) })}
                    </span>
                  </span>
                  <Pressable
                    aria-label={t('logPortion', { name: food.name })}
                    onClick={() => {
                      void logPortion(food)
                    }}
                    className="shrink-0 p-4"
                  >
                    <span className="flex size-40 items-center justify-center rounded-full bg-accent text-accent-ink">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden
                        className="size-16 fill-none stroke-current"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                      >
                        <path d="M6 12h12M12 6v12" />
                      </svg>
                    </span>
                  </Pressable>
                </li>
              ))}
            </ul>
            {fill.length > 1 && (
              <p className="num text-label text-ink-2">
                {t('fillSum', {
                  protein: whole.format(sum.proteinG),
                  kcal: whole.format(sum.kcal),
                })}
              </p>
            )}
          </div>
        )}
        {foods.length === 0 && (
          <PressableLink
            href="/food/add"
            className="self-start rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
          >
            {t('addManual')}
          </PressableLink>
        )}
      </DayCard>
      <TargetsSheet
        open={editingTargets}
        onClose={() => {
          setEditingTargets(false)
        }}
        targets={targets}
      />
    </>
  )
}
