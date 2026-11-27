'use client'

import {
  addDays,
  domainConfig,
  foodCheck,
  type LocalDate,
  type Phase,
  type RateStatus,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { db } from '@/db/client'
import { foodDay } from '@/db/food'
import { currentProfile } from '@/db/profile'
import { useLiveQuery } from '@/db/use-live-query'
import { Chevron } from '@/ui/chevron'
import { PressableLink } from '@/ui/pressable'

const { days: SPAN, minLoggedDays, closeKcal } = domainConfig.foodCheck

/**
 * "Compare with the food log" on the weight page ("Progress charts" in
 * docs/design-system.md): over the fourteen days before today, the average
 * energy against the daily target and the days the protein target was met,
 * and, while gaining, the likely cause when the weight moves too slowly or
 * too fast. Hidden until daily targets are set.
 */
export function FoodCheckCard({
  today,
  status,
  phase,
}: {
  today: LocalDate
  status: RateStatus | null
  phase: Phase | null
}) {
  const t = useTranslations('progress.foodCheck')
  const locale = useLocale()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const read = useCallback(async () => {
    const profile = await currentProfile(db)
    if (profile === undefined) return null
    const dates = Array.from({ length: SPAN }, (_, index) => addDays(today, index - SPAN))
    const days = await Promise.all(dates.map((date) => foodDay(db, date)))
    return foodCheck(
      days.map(({ meals, totals }) => ({ ...totals, meals: meals.length })),
      { proteinG: profile.proteinValue, kcal: profile.kcalTarget },
    )
  }, [today])
  const check = useLiveQuery(read)
  if (check === undefined || check === null) return null

  const enough = check.loggedDays >= minLoggedDays
  const gap = Math.abs(check.kcalVsTarget)
  const energy = gap < closeKcal ? 'close' : check.kcalVsTarget > 0 ? 'above' : 'below'
  // Causes are written for gaining, the phase the app is built around.
  let cause: string | null = null
  if (enough && (phase ?? 'bulk') === 'bulk') {
    if (status === 'onTarget') cause = t('causeOnTarget')
    else if (status === 'tooSlow')
      cause = energy === 'below' ? t('causeEatMore') : t('causeUnlogged')
    else if (status === 'tooFast') cause = t('causeTooFast')
  }

  return (
    <section className="flex flex-col gap-8 rounded-group bg-surface px-16 pt-16 pb-4">
      <div className="flex items-center justify-between gap-12">
        <h2 className="text-label text-ink-2">{t('heading')}</h2>
        <span className="rounded-full bg-sunk px-8 text-label text-ink-2">{t('source')}</span>
      </div>
      {enough ? (
        <>
          <p className="text-body">
            {t(`energy.${energy}`, { kcal: whole.format(gap) })}
            {t('protein', { met: check.proteinMetDays, logged: check.loggedDays })}
          </p>
          {cause !== null && <p className="text-body">{cause}</p>}
        </>
      ) : (
        <p className="text-body text-ink-2">
          {t('notEnough', { logged: check.loggedDays, min: minLoggedDays })}
        </p>
      )}
      <PressableLink
        href="/food"
        className="flex items-center justify-between border-t border-line py-12 text-body font-semibold"
      >
        {t('openFood')}
        <span className="text-ink-3">
          <Chevron direction="right" />
        </span>
      </PressableLink>
    </section>
  )
}
