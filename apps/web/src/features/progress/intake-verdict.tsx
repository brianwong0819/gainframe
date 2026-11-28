'use client'

import { domainConfig, type FoodCheck, type Phase } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'

import { Verdict } from '@/ui/verdict'

/**
 * The protein verdict for a span of days: on target on average, or the
 * average shortfall a day, then the average and the target.
 */
export function ProteinVerdict({ check, targetG }: { check: FoodCheck; targetG: number }) {
  const t = useTranslations('progress.protein')
  const locale = useLocale()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const average = check.averageProteinG
  if (average === null) return <p className="text-label text-ink-2">{t('noneLogged')}</p>
  const figures = t('averageLine', {
    average: whole.format(average),
    target: whole.format(targetG),
  })
  return average >= targetG ? (
    <Verdict tone="ok" word={t('onTarget')}>
      {figures}
    </Verdict>
  ) : (
    <Verdict tone="attention" word={t('short', { grams: whole.format(targetG - average) })}>
      {figures}
    </Verdict>
  )
}

/**
 * The energy verdict for a span of days: the average a day against the
 * target. A gap is a shortfall (`--short`) only when it works against the
 * phase: under the target while gaining, over it while cutting.
 */
export function EnergyVerdict({
  check,
  targetKcal,
  phase,
}: {
  check: FoodCheck
  targetKcal: number
  phase: Phase | null
}) {
  const t = useTranslations('progress.protein')
  const locale = useLocale()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  if (check.loggedDays === 0) return null
  const gap = check.kcalVsTarget
  const figures = t('kcalTarget', { kcal: whole.format(targetKcal) })
  if (Math.abs(gap) < domainConfig.foodCheck.closeKcal) {
    return (
      <Verdict tone="ok" word={t('kcalClose')}>
        {figures}
      </Verdict>
    )
  }
  const against = (phase ?? 'bulk') === 'bulk' ? gap < 0 : phase === 'cut' && gap > 0
  return (
    <Verdict
      tone={against ? 'attention' : 'plain'}
      word={t(gap > 0 ? 'kcalAbove' : 'kcalBelow', { kcal: whole.format(Math.abs(gap)) })}
    >
      {figures}
    </Verdict>
  )
}
