'use client'

import { domainConfig, foodCheck, type LocalDate, proteinMet, toLocalDate } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import { deviceTimeZone } from '@/i18n/time-zone'
import { Chevron } from '@/ui/chevron'
import { PressableLink } from '@/ui/pressable'

import { DayBars } from './day-bars'
import { EnergyVerdict } from './intake-verdict'
import { useIntake } from './use-intake'

const DAYS = domainConfig.foodCheck.days
const HEIGHT = 64

/**
 * The protein card of the Progress page ("Progress charts" in
 * docs/design-system.md): the fourteen days before today as columns against
 * the protein target, `--accent` on the days that met it, the count as the
 * large number and the average energy against its target beneath; it opens
 * the protein page. Before targets are set, or before a meal is logged, it is
 * the first-days version with one button to the screen that produces the data.
 */
export function ProteinCard() {
  const t = useTranslations('progress.protein')
  const [today] = useState<LocalDate>(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const intake = useIntake(today, DAYS)
  if (intake === undefined) return null
  const { days, targets, phase } = intake
  const check = targets === null ? null : foodCheck(days, targets)

  if (targets === null || check === null || check.loggedDays === 0) {
    return (
      <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
        <h2 className="text-label text-ink-2">{t('heading')}</h2>
        <p className="text-body text-ink-2">{targets === null ? t('noTargets') : t('empty')}</p>
        <PressableLink
          href={targets === null ? '/food' : '/food/add'}
          className="rounded-full bg-sunk px-16 py-12 text-center text-body font-semibold text-ink"
        >
          {targets === null ? t('setTargets') : t('logMeal')}
        </PressableLink>
      </section>
    )
  }

  return (
    <Link href="/progress/protein" className="flex flex-col gap-4 rounded-group bg-surface p-16">
      <div className="flex items-center justify-between gap-12 text-label text-ink-2">
        <h2>{t('heading')}</h2>
        <Chevron direction="right" />
      </div>
      <p className="flex items-baseline gap-4 pt-4">
        <span className="num text-title">{check.proteinMetDays.toString()}</span>
        <span className="text-label text-ink-2">{t('metOf', { logged: check.loggedDays })}</span>
      </p>
      <EnergyVerdict check={check} targetKcal={targets.kcal} phase={phase} />
      <div className="mt-8">
        <DayBars
          days={days}
          value={({ proteinG }) => proteinG}
          target={targets.proteinG}
          tone={(day) => (proteinMet(day, targets.proteinG) ? 'met' : 'plain')}
          height={HEIGHT}
          label={t('chartLabel', { met: check.proteinMetDays, logged: check.loggedDays })}
        />
      </div>
    </Link>
  )
}
