'use client'

import type { MealWithItems } from '@/db/food'
import { type NutritionTotals, proteinPace } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'

import { Chevron } from '@/ui/chevron'
import { Pressable } from '@/ui/pressable'
import { Verdict } from '@/ui/verdict'

export interface Targets {
  proteinG: number
  kcal: number
}

// The day at a glance (design-system.md, "Food logging"): protein still to go
// as the large number, eaten / target beside it, a bar with one segment per
// meal, then energy. Without targets it shows what was eaten and offers
// to set them; with targets, a tap on eaten / target changes them, and a
// verdict line says whether protein is on pace for the hour. A gap is never
// shown as a failure during the day: only a past day that missed uses `--short`.
export function DayCard({
  meals,
  totals,
  targets,
  onEditTargets,
  past = false,
  heading,
  children,
}: {
  meals: MealWithItems[]
  totals: NutritionTotals
  targets: Targets | null
  onEditTargets: () => void
  /** A day before today, which is over: its verdict is met or missed. */
  past?: boolean
  /** Replaces the "Protein" label, e.g. Today's line about the day's workout. */
  heading?: ReactNode
  /** Rows that continue the card, e.g. Today's suggestion. */
  children?: ReactNode
}) {
  const t = useTranslations('food')
  const locale = useLocale()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const [hour] = useState(() => {
    const now = new Date()
    return now.getHours() + now.getMinutes() / 60
  })
  const eaten = Math.round(totals.proteinG)
  const toGo = targets === null ? null : Math.max(0, Math.round(targets.proteinG - totals.proteinG))
  const met = toGo === 0
  // Each meal's share of the bar, capped at the target so the bar stays full.
  const scale = targets === null ? 0 : Math.max(targets.proteinG, totals.proteinG)
  const pace =
    targets === null ? null : proteinPace(totals.proteinG, targets.proteinG, past ? null : hour)
  return (
    <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
      <div className="flex items-baseline justify-between gap-12">
        {heading ?? <h2 className="text-label text-ink-3">{t('protein')}</h2>}
        {targets !== null && (
          <Pressable
            aria-label={t('editTargets')}
            onClick={onEditTargets}
            className="-my-8 flex items-center gap-4 py-8 text-label text-ink-2"
          >
            <span className="num">
              {t('eatenOfTarget', {
                eaten: whole.format(eaten),
                target: whole.format(targets.proteinG),
              })}
            </span>
            <span className="text-ink-3">
              <Chevron direction="right" />
            </span>
          </Pressable>
        )}
      </div>
      {toGo === null ? (
        <p className="flex items-baseline gap-4">
          <span className="num text-display">{whole.format(eaten)}</span>
          <span className="text-section text-ink-2">{t('unitG')}</span>
        </p>
      ) : (
        <p className="flex flex-wrap items-baseline gap-x-8 gap-y-4">
          {met ? (
            <>
              <span className="num text-display text-accent">{whole.format(eaten)}</span>
              <span className="text-section text-ink-2">{t('unitG')}</span>
              <span className="text-body text-accent">{t('targetMet')}</span>
            </>
          ) : (
            <>
              <span className="text-body text-ink-2">{t('toGoLead')}</span>
              <span className="num text-display">{whole.format(toGo)}</span>
              <span className="text-section text-ink-2">{t('unitG')}</span>
            </>
          )}
        </p>
      )}
      {pace?.status === 'onPace' && (
        <Verdict tone="ok" word={t('pace.onPace')}>
          {t('pace.keepUp')}
        </Verdict>
      )}
      {pace?.status === 'behind' && (
        <Verdict tone="plain" word={t('pace.behind')}>
          {t('pace.expected', { value: whole.format(pace.expectedG) })}
        </Verdict>
      )}
      {pace?.status === 'missed' && (
        <Verdict tone="attention" word={t('pace.missed')}>
          {t('pace.reached', { share: pace.share })}
        </Verdict>
      )}
      {targets !== null && (
        <div aria-hidden className="flex h-8 gap-4 overflow-hidden rounded-full bg-sunk">
          {meals
            .toReversed()
            .filter(({ totals: meal }) => meal.proteinG > 0)
            .map(({ meal, totals: mealTotals }) => (
              <span
                key={meal.id}
                className="h-full bg-accent"
                style={{ width: `${String((mealTotals.proteinG / scale) * 100)}%` }}
              />
            ))}
        </div>
      )}
      <p className="num text-label text-ink-2">
        {targets === null
          ? t('energyEaten', { eaten: whole.format(totals.kcal) })
          : t('energyOfTarget', {
              eaten: whole.format(totals.kcal),
              target: whole.format(targets.kcal),
            })}
      </p>
      {targets === null && (
        <Pressable
          onClick={onEditTargets}
          className="self-start rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
        >
          {t('setTargets')}
        </Pressable>
      )}
      {children}
    </section>
  )
}
