'use client'

import {
  dailyWeights,
  type LocalDate,
  type Phase,
  rateStatus,
  type RateStatus,
  targetRate,
  toLocalDate,
  type WeeklyRate,
  weeklyRate,
  weighInsNeeded,
  weightTrend,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import { weightData } from '@/db/body-metrics'
import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'
import { Chevron } from '@/ui/chevron'

import { WeighInButton } from './weigh-in-button'

const readWeight = () => weightData(db)

const tagClass: Record<RateStatus, string> = {
  onTarget: 'bg-accent-wash text-accent',
  tooSlow: 'bg-short-wash text-short',
  tooFast: 'bg-sunk text-ink-2',
  offTarget: 'bg-sunk text-ink-2',
}

// Whether the weekly rate is on target, as a tag; `--short` only for too slow.
export function RateTag({ status }: { status: RateStatus }) {
  const t = useTranslations('weight')
  return (
    <span className={`rounded-full px-8 text-label ${tagClass[status]}`}>
      {t(`status.${status}`)}
    </span>
  )
}

// "+0.25 kg a week · target +0.15 to +0.31 kg", the target in kg at the
// current average.
export function RateLine({
  weekly,
  averageKg,
  phase,
}: {
  weekly: WeeklyRate | null
  averageKg: number
  phase: Phase | null
}) {
  const t = useTranslations('weight')
  const locale = useLocale()
  const rate = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  })
  const target = targetRate(phase)
  const perWeek = (pct: number) => rate.format((averageKg * pct) / 100)
  return (
    <p className="text-label text-ink-2">
      {weekly === null ? (
        t('noRate')
      ) : (
        <>
          <span className="num text-ink">{t('rate', { rate: rate.format(weekly.kgPerWeek) })}</span>
          {' · '}
          <span className="num">
            {t('targetRate', { min: perWeek(target.min), max: perWeek(target.max) })}
          </span>
        </>
      )}
    </p>
  )
}

// Body weight on Today: the seven-day average, the weekly rate against the
// phase's target and whether it is on target, and "Log weight", which opens
// the weigh-in sheet (two taps to log the day's weight). Before seven
// weigh-ins it shows the latest one and how many more the average needs.
export function WeightCard() {
  const t = useTranslations('weight')
  const locale = useLocale()
  const tenth = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const [today] = useState<LocalDate>(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const data = useLiveQuery(readWeight)
  if (data === undefined) return null

  const days = dailyWeights(data.rows)
  const trend = weightTrend(days)
  const latest = trend.at(-1)
  const needed = weighInsNeeded(days)
  const weekly = weeklyRate(days)
  const last = data.rows.at(-1)
  const loggedToday = last?.localDate === today

  let body
  if (latest === undefined) {
    body = <p className="text-body text-ink-2">{t('empty')}</p>
  } else if (needed > 0) {
    body = (
      <>
        <p className="flex items-baseline gap-4">
          <span className="num text-display">{tenth.format(latest.weightKg)}</span>
          <span className="text-section text-ink-2">kg</span>
        </p>
        <p className="text-label text-ink-2">{t('needMore', { count: needed })}</p>
      </>
    )
  } else {
    const status = weekly === null ? null : rateStatus(weekly.pctPerWeek, data.phase)
    body = (
      <>
        <div className="flex items-end justify-between gap-12">
          <p className="flex items-baseline gap-4">
            <span className="num text-display">{tenth.format(latest.averageKg)}</span>
            <span className="text-section text-ink-2">kg</span>
          </p>
          {status !== null && <RateTag status={status} />}
        </div>
        <RateLine weekly={weekly} averageKg={latest.averageKg} phase={data.phase} />
      </>
    )
  }

  return (
    <section className="flex flex-col gap-8 rounded-group bg-surface p-16">
      <Link href="/progress/weight" className="-my-12 flex items-center justify-between py-12">
        <h2 className="text-label text-ink-3">
          {latest !== undefined && needed === 0 ? t('averageHeading') : t('heading')}
        </h2>
        <span className="flex items-center gap-4 text-body text-ink-2">
          {t('trend')}
          <Chevron direction="right" />
        </span>
      </Link>
      {body}
      <div className="mt-4 flex items-center justify-between gap-12 border-t border-line pt-8">
        <span className="num text-label text-ink-2">
          {loggedToday ? t('today', { weight: tenth.format(last.weightKg) }) : t('notToday')}
        </span>
        <WeighInButton
          rows={data.rows}
          today={today}
          className="rounded-full bg-sunk px-16 py-12 text-body font-semibold text-ink"
        >
          {loggedToday ? t('edit') : t('log')}
        </WeighInButton>
      </div>
    </section>
  )
}
