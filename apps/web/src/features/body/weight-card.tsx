'use client'

import {
  dailyWeights,
  type LocalDate,
  rateStatus,
  type RateStatus,
  targetRate,
  toLocalDate,
  weeklyRate,
  weighInsNeeded,
  weightTrend,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { liveBodyMetrics } from '@/db/body-metrics'
import { db } from '@/db/client'
import { currentProfile } from '@/db/profile'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'
import { Pressable } from '@/ui/pressable'

import { WeighInSheet } from './weigh-in-sheet'

const readWeight = async () => {
  const [rows, profile] = await Promise.all([liveBodyMetrics(db), currentProfile(db)])
  return { rows, phase: profile?.phase ?? null }
}

const tagClass: Record<RateStatus, string> = {
  onTarget: 'bg-accent-wash text-accent',
  tooSlow: 'bg-short-wash text-short',
  tooFast: 'bg-sunk text-ink-2',
  offTarget: 'bg-sunk text-ink-2',
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
  const rate = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  })
  const [today] = useState<LocalDate>(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const data = useLiveQuery(readWeight)
  const [sheet, setSheet] = useState({ open: false, key: 0 })
  if (data === undefined) return null

  const days = dailyWeights(data.rows)
  const trend = weightTrend(days)
  const latest = trend.at(-1)
  const needed = weighInsNeeded(days)
  const weekly = weeklyRate(days)
  const target = targetRate(data.phase)
  const last = data.rows.at(-1)
  const scanRow = data.rows.findLast(
    (row) => row.bodyFatPct !== null && row.skeletalMuscleKg !== null,
  )
  const lastScan =
    scanRow?.bodyFatPct == null || scanRow.skeletalMuscleKg === null
      ? null
      : { bodyFatPct: scanRow.bodyFatPct, skeletalMuscleKg: scanRow.skeletalMuscleKg }
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
    const perWeek = (pct: number) => rate.format((latest.averageKg * pct) / 100)
    body = (
      <>
        <div className="flex items-end justify-between gap-12">
          <p className="flex items-baseline gap-4">
            <span className="num text-display">{tenth.format(latest.averageKg)}</span>
            <span className="text-section text-ink-2">kg</span>
          </p>
          {status !== null && (
            <span className={`rounded-full px-8 text-label ${tagClass[status]}`}>
              {t(`status.${status}`)}
            </span>
          )}
        </div>
        <p className="text-label text-ink-2">
          {weekly === null ? (
            t('noRate')
          ) : (
            <>
              <span className="num text-ink">
                {t('rate', { rate: rate.format(weekly.kgPerWeek) })}
              </span>
              {' · '}
              <span className="num">
                {t('targetRate', { min: perWeek(target.min), max: perWeek(target.max) })}
              </span>
            </>
          )}
        </p>
      </>
    )
  }

  return (
    <section className="flex flex-col gap-8 rounded-group bg-surface p-16">
      <h2 className="text-label text-ink-3">
        {latest !== undefined && needed === 0 ? t('averageHeading') : t('heading')}
      </h2>
      {body}
      <div className="mt-4 flex items-center justify-between gap-12 border-t border-line pt-8">
        <span className="num text-label text-ink-2">
          {loggedToday ? t('today', { weight: tenth.format(last.weightKg) }) : t('notToday')}
        </span>
        <Pressable
          onClick={() => {
            setSheet(({ key }) => ({ open: true, key: key + 1 }))
          }}
          className="rounded-full bg-sunk px-16 py-12 text-body font-semibold text-ink"
        >
          {loggedToday ? t('edit') : t('log')}
        </Pressable>
      </div>
      <WeighInSheet
        key={sheet.key}
        open={sheet.open}
        onClose={() => {
          setSheet(({ key }) => ({ open: false, key }))
        }}
        today={today}
        last={last}
        lastScan={lastScan}
      />
    </section>
  )
}
