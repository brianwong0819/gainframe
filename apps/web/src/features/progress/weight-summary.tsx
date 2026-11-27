'use client'

import {
  addDays,
  dailyWeights,
  type LocalDate,
  rateStatus,
  targetRange,
  toLocalDate,
  weeklyRate,
  weighInsNeeded,
  weightTrend,
} from '@gainframe/shared'
import { scaleLinear } from '@visx/scale'
import { Area, LinePath } from '@visx/shape'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import { weightData } from '@/db/body-metrics'
import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { RateLine, RateTag } from '@/features/body/weight-card'
import { WeighInButton } from '@/features/body/weigh-in-button'
import { formatShortDay } from '@/features/history/dates'
import { deviceTimeZone } from '@/i18n/time-zone'
import { Chevron } from '@/ui/chevron'
import { useWidth } from '@/ui/plot'

const readWeight = () => weightData(db)

// The Progress page shows the last twelve weeks, like the weight page's default.
const SPAN_DAYS = 84
const HEIGHT = 84
const DOTS_HEIGHT = 56
const PAD = 6

const at = (date: LocalDate) => Date.parse(`${date}T12:00:00.000Z`)

/**
 * The weight card of the Progress page ("Progress charts" in
 * docs/design-system.md): the 7-day average, the weekly rate against the
 * target and a small chart of the last twelve weeks, opening the weight page.
 * Before seven weigh-ins it is the first-days version: the latest weigh-in,
 * the dots logged so far, how many more days the average needs, and the button
 * that logs today's weight.
 */
export function WeightSummary() {
  const t = useTranslations('progress')
  const tWeight = useTranslations('weight')
  const locale = useLocale()
  const tenth = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const [today] = useState<LocalDate>(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const [box, width] = useWidth()
  const data = useLiveQuery(readWeight)
  if (data === undefined) return null

  const days = dailyWeights(data.rows)
  const trend = weightTrend(days)
  const latest = trend.at(-1)
  const needed = weighInsNeeded(days)

  if (latest === undefined || needed > 0) {
    const y = scaleLinear<number>({
      domain: [
        Math.min(...days.map(({ weightKg }) => weightKg)) - 0.5,
        Math.max(...days.map(({ weightKg }) => weightKg)) + 0.5,
      ],
      range: [DOTS_HEIGHT - PAD, PAD],
    })
    // One slot per day the average needs, so the dots fill in left to right.
    const x = (index: number) => PAD * 2 + (index * (width - PAD * 4)) / (days.length + needed - 1)
    return (
      <section className="flex flex-col gap-8 rounded-group bg-surface p-16">
        <div className="flex justify-between gap-12 text-label text-ink-2">
          <h2>{latest === undefined ? tWeight('heading') : t('weightLatest')}</h2>
          {days.length > 0 && <span>{t('daysLogged', { count: days.length })}</span>}
        </div>
        {latest !== undefined && (
          <p className="flex items-baseline gap-4">
            <span className="num text-title">{tenth.format(latest.weightKg)}</span>
            <span className="text-label text-ink-2">kg</span>
          </p>
        )}
        <div ref={box} style={{ height: latest === undefined ? 0 : DOTS_HEIGHT }}>
          {width > 0 && latest !== undefined && (
            <svg
              width={width}
              height={DOTS_HEIGHT}
              role="img"
              aria-label={t('weightDotsLabel', { count: days.length })}
            >
              {days.map(({ localDate, weightKg }, index) => (
                <circle
                  key={localDate}
                  cx={x(index)}
                  cy={y(weightKg)}
                  r={index === days.length - 1 ? 5 : 4}
                  className={index === days.length - 1 ? 'fill-ink stroke-surface' : 'fill-ink-3'}
                  strokeWidth={2}
                />
              ))}
            </svg>
          )}
        </div>
        <p className="text-body text-ink-2">
          {latest === undefined ? tWeight('empty') : t('weightNeedMore', { count: needed })}
        </p>
        <WeighInButton
          rows={data.rows}
          today={today}
          className="mt-4 rounded-full bg-sunk px-16 py-12 text-body font-semibold text-ink"
        >
          {t('logToday')}
        </WeighInButton>
      </section>
    )
  }

  const from = addDays(today, 1 - SPAN_DAYS)
  const points = trend.filter(({ localDate }) => localDate >= from)
  const first = points[0] ?? latest
  const weekly = weeklyRate(days)
  const status = weekly === null ? null : rateStatus(weekly.pctPerWeek, data.phase)
  const range = targetRange(first.averageKg, first.localDate, [first.localDate, today], data.phase)
  const values = [
    ...points.map(({ averageKg }) => averageKg),
    ...range.flatMap(({ lowKg, highKg }) => [lowKg, highKg]),
  ]
  const x = scaleLinear<number>({
    domain: [at(from), at(today)],
    range: [PAD, Math.max(PAD, width - PAD)],
  })
  const y = scaleLinear<number>({
    domain: [Math.min(...values), Math.max(...values)],
    range: [HEIGHT - PAD, PAD],
  })

  return (
    <Link href="/progress/weight" className="flex flex-col gap-4 rounded-group bg-surface p-16">
      <div className="flex items-center justify-between gap-12 text-label text-ink-2">
        <h2>{tWeight('averageHeading')}</h2>
        <Chevron direction="right" />
      </div>
      <div className="flex items-end justify-between gap-12 pt-4">
        <p className="flex items-baseline gap-4">
          <span className="num text-title">{tenth.format(latest.averageKg)}</span>
          <span className="text-label text-ink-2">kg</span>
        </p>
        {status !== null && <RateTag status={status} />}
      </div>
      <RateLine weekly={weekly} averageKg={latest.averageKg} phase={data.phase} />
      <div ref={box} className="mt-8" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={t('weightChartLabel')}>
            <Area
              data={range}
              x={({ localDate }) => x(at(localDate))}
              y0={({ lowKg }) => y(lowKg)}
              y1={({ highKg }) => y(highKg)}
              className="fill-accent-wash"
            />
            <LinePath
              data={points}
              x={({ localDate }) => x(at(localDate))}
              y={({ averageKg }) => y(averageKg)}
              pathLength={1}
              className="chart-draw fill-none stroke-ink"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={x(at(latest.localDate))}
              cy={y(latest.averageKg)}
              r={5}
              className={`stroke-surface ${status === 'onTarget' ? 'fill-accent' : status === 'tooSlow' ? 'fill-short' : 'fill-ink'}`}
              strokeWidth={2}
            />
          </svg>
        )}
      </div>
      <div className="flex justify-between pt-4 text-caption text-ink-2">
        <span>{formatShortDay(from, locale)}</span>
        <span>{t('today')}</span>
      </div>
    </Link>
  )
}
