'use client'

import {
  addDays,
  type LocalDate,
  type Phase,
  type RangePoint,
  rateStatus,
  type TrendPoint,
  type WeeklyRate,
} from '@gainframe/shared'
import { motion } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { RateLine, RateTag } from '@/features/body/weight-card'
import { formatDay, formatShortDay } from '@/features/history/dates'
import { fade } from '@/ui/motion'
import { RollingNumber } from '@/ui/rolling-number'

import { WeightChart, WeightLegend } from './weight-chart'

/**
 * The weight page's main card: the 7-day average with the weekly rate and the
 * status tag, the chart and its legend. Reading the chart puts the day under
 * the finger in the header. The reading lives here, not in the page, so a
 * drag re-renders this card only; a new range mounts a new card.
 */
export function WeightReadingCard({
  points,
  latest,
  wedge,
  weekly,
  phase,
  needed,
  from,
  today,
  draw,
}: {
  points: readonly TrendPoint[]
  latest: TrendPoint | undefined
  wedge: readonly RangePoint[] | null
  weekly: WeeklyRate | null
  phase: Phase | null
  needed: number
  from: LocalDate
  today: LocalDate
  draw: boolean
}) {
  const t = useTranslations('progress.weight')
  const tWeight = useTranslations('weight')
  const locale = useLocale()
  const [tenth] = useState(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  )
  const [reading, setReading] = useState<number | null>(null)
  const [xLabels] = useState(() => {
    const spanDays =
      (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000
    return [
      formatShortDay(from, locale),
      formatShortDay(addDays(from, Math.round(spanDays / 2)), locale),
      t('today'),
    ] as const
  })
  const [yFormat] = useState(() => (value: number) => tenth.format(value))

  if (latest === undefined) {
    return (
      <section className="rounded-group bg-surface p-16">
        <p className="text-body text-ink-2">{tWeight('empty')}</p>
      </section>
    )
  }

  const showTrend = needed === 0
  const status = weekly === null ? null : rateStatus(weekly.pctPerWeek, phase)
  const read =
    reading === null || Reflect.get(globalThis, 'diagNoHeader') === true ? undefined : points[reading]
  const latestDate =
    latest.localDate === today ? t('today') : formatShortDay(latest.localDate, locale)

  let label
  let value
  let sub
  if (read !== undefined) {
    label = t('readingLabel', { date: formatDay(read.localDate, locale) })
    value = showTrend ? read.averageKg : read.weightKg
    sub = (
      <p className="num text-label text-ink-2">
        {t('readingWeighIn', { weight: tenth.format(read.weightKg) })}
      </p>
    )
  } else if (showTrend) {
    label = t('averageLabel', { date: latestDate })
    value = latest.averageKg
    sub = <RateLine weekly={weekly} averageKg={latest.averageKg} phase={phase} />
  } else {
    label = t('latestLabel', { date: latestDate })
    value = latest.weightKg
    sub = <p className="text-label text-ink-2">{tWeight('needMore', { count: needed })}</p>
  }

  return (
    <section className="flex flex-col gap-4 rounded-group bg-surface p-16">
      <div className="flex items-center justify-between gap-12">
        <h2 className="text-label text-ink-2">{label}</h2>
        {read === undefined && showTrend && status !== null && <RateTag status={status} />}
      </div>
      <p className="flex items-baseline gap-4 pt-4">
        <span className="num text-title">
          {read === undefined ? <RollingNumber value={tenth.format(value)} /> : tenth.format(value)}
        </span>
        <span className="text-label text-ink-2">kg</span>
      </p>
      {sub}
      <div className="pt-8">
        {points.length === 0 ? (
          <p className="py-28 text-center text-body text-ink-2">{t('noneInRange')}</p>
        ) : (
          <motion.div
            initial={draw ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={fade}
          >
            <WeightChart
              points={points}
              range={wedge}
              status={status}
              from={from}
              to={today}
              xLabels={xLabels}
              yFormat={yFormat}
              reading={reading}
              onRead={setReading}
              draw={draw}
            />
          </motion.div>
        )}
      </div>
      {showTrend && points.length > 0 && (
        <div className="pt-8">
          <WeightLegend />
        </div>
      )}
    </section>
  )
}
