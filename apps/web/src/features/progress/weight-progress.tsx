'use client'

import {
  addDays,
  compositionChange,
  dailyWeights,
  type LocalDate,
  rateStatus,
  targetRange,
  toLocalDate,
  weeklyAverages,
  weeklyRate,
  weighInsNeeded,
  weightTrend,
} from '@gainframe/shared'
import { motion } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { weightData } from '@/db/body-metrics'
import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { RateLine, RateTag } from '@/features/body/weight-card'
import { WeighInButton } from '@/features/body/weigh-in-button'
import { formatDay, formatShortDay } from '@/features/history/dates'
import { deviceTimeZone } from '@/i18n/time-zone'
import { fade } from '@/ui/motion'
import { RollingNumber } from '@/ui/rolling-number'
import { SegmentedControl } from '@/ui/segmented-control'

import { WeightChart, WeightLegend } from './weight-chart'

const readWeight = () => weightData(db)

const ranges = ['4w', '12w', 'all'] as const
type Range = (typeof ranges)[number]
const rangeDays: Record<Exclude<Range, 'all'>, number> = { '4w': 28, '12w': 84 }
const WEEKS_LISTED = 5

/**
 * The weight page ("Progress charts" in docs/design-system.md): the range
 * control, the card with the 7-day average, the weekly rate and the chart,
 * the weekly averages, the change between two scans, and "Log today's
 * weight" docked at the bottom. Reading the chart puts the day under the
 * finger in the card header.
 */
export function WeightProgress() {
  const t = useTranslations('progress.weight')
  const tWeight = useTranslations('weight')
  const locale = useLocale()
  const tenth = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const signed = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  })
  const change = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  })
  const [today] = useState<LocalDate>(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const [range, setRange] = useState<Range>('12w')
  const [ranged, setRanged] = useState(false)
  const [reading, setReading] = useState<number | null>(null)
  const data = useLiveQuery(readWeight)
  if (data === undefined) return null

  const days = dailyWeights(data.rows)
  const trend = weightTrend(days)
  const showTrend = weighInsNeeded(days) === 0
  const firstDate = trend[0]?.localDate ?? today
  const from = range === 'all' ? firstDate : addDays(today, 1 - rangeDays[range])
  const points = trend.filter(({ localDate }) => localDate >= from)
  const first = points[0]
  const latest = trend.at(-1)
  const weekly = weeklyRate(days)
  const status = weekly === null ? null : rateStatus(weekly.pctPerWeek, data.phase)
  const wedge =
    showTrend && first !== undefined
      ? targetRange(first.averageKg, first.localDate, [first.localDate, today], data.phase)
      : null
  const weeks = weeklyAverages(days, WEEKS_LISTED)
  const scans = compositionChange(data.rows)
  const read = reading === null ? undefined : points[reading]
  const loggedToday = data.rows.at(-1)?.localDate === today
  const spanDays = (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000
  const middle = addDays(from, Math.round(spanDays / 2))

  let header
  if (read !== undefined) {
    header = {
      label: t('readingLabel', { date: formatDay(read.localDate, locale) }),
      value: showTrend ? read.averageKg : read.weightKg,
      sub: (
        <p className="num text-label text-ink-2">
          {t('readingWeighIn', { weight: tenth.format(read.weightKg) })}
        </p>
      ),
    }
  } else if (latest !== undefined) {
    const date = latest.localDate === today ? t('today') : formatShortDay(latest.localDate, locale)
    header = showTrend
      ? {
          label: t('averageLabel', { date }),
          value: latest.averageKg,
          sub: <RateLine weekly={weekly} averageKg={latest.averageKg} phase={data.phase} />,
        }
      : {
          label: t('latestLabel', { date }),
          value: latest.weightKg,
          sub: (
            <p className="text-label text-ink-2">
              {tWeight('needMore', { count: weighInsNeeded(days) })}
            </p>
          ),
        }
  }

  return (
    <>
      {trend.length > 0 && (
        <SegmentedControl
          label={t('rangeLabel')}
          options={ranges}
          value={range}
          onChange={(next) => {
            setRange(next)
            setRanged(true)
            setReading(null)
          }}
          optionLabel={(option) => t(`range.${option}`)}
        />
      )}
      <section className="flex flex-col gap-4 rounded-group bg-surface p-16">
        {header === undefined ? (
          <p className="text-body text-ink-2">{tWeight('empty')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-12">
              <h2 className="text-label text-ink-2">{header.label}</h2>
              {read === undefined && showTrend && status !== null && <RateTag status={status} />}
            </div>
            <p className="flex items-baseline gap-4 pt-4">
              <span className="num text-title">
                {read === undefined ? (
                  <RollingNumber value={tenth.format(header.value)} />
                ) : (
                  tenth.format(header.value)
                )}
              </span>
              <span className="text-label text-ink-2">kg</span>
            </p>
            {header.sub}
            <div className="pt-8">
              {points.length === 0 ? (
                <p className="py-28 text-center text-body text-ink-2">{t('noneInRange')}</p>
              ) : (
                <motion.div
                  key={range}
                  initial={ranged ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={fade}
                >
                  <WeightChart
                    points={points}
                    range={wedge}
                    status={status}
                    from={from}
                    to={today}
                    xLabels={[
                      formatShortDay(from, locale),
                      formatShortDay(middle, locale),
                      t('today'),
                    ]}
                    yFormat={(value) => tenth.format(value)}
                    reading={reading}
                    onRead={setReading}
                    draw={!ranged}
                  />
                </motion.div>
              )}
            </div>
            {showTrend && points.length > 0 && (
              <div className="pt-8">
                <WeightLegend />
              </div>
            )}
          </>
        )}
      </section>

      {weeks.length > 0 && (
        <section className="rounded-group bg-surface px-16 pt-16 pb-4">
          <table className="w-full">
            <thead>
              <tr className="text-label text-ink-2">
                <th className="pb-8 text-left font-medium">{t('weeks')}</th>
                <th className="pb-8 text-right font-medium" colSpan={2}>
                  {t('vsWeekBefore')}
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.to} className="border-t border-line">
                  <td className="py-12 text-body">
                    {t('weekSpan', {
                      from: formatShortDay(week.from, locale),
                      to: formatShortDay(week.to, locale),
                    })}
                  </td>
                  <td className="num py-12 pl-12 text-right text-body font-semibold whitespace-nowrap">
                    {tenth.format(week.averageKg)}{' '}
                    <span className="text-label font-normal text-ink-2">kg</span>
                  </td>
                  <td className="num py-12 pl-16 text-right text-label text-ink-2">
                    {week.changeKg === null ? '–' : change.format(week.changeKg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {scans !== null && (
        <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
          <div className="flex justify-between gap-12 text-label text-ink-2">
            <h2>{t('composition')}</h2>
            <span>
              {t('compositionSpan', {
                from: formatShortDay(scans.from, locale),
                to: formatShortDay(scans.to, locale),
              })}
            </span>
          </div>
          <dl className="grid grid-cols-3 gap-12">
            {(
              [
                ['compositionWeight', scans.weightKg],
                ['compositionLean', scans.leanKg],
                ['compositionFat', scans.fatKg],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="flex flex-col-reverse">
                <dt className="text-label text-ink-2">{t(key)}</dt>
                <dd className="flex items-baseline gap-4 whitespace-nowrap">
                  <span className="num text-section">{signed.format(value)}</span>
                  <span className="text-label text-ink-2">kg</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-label font-normal text-ink-2">{t('compositionNote')}</p>
        </section>
      )}

      <div className="screen-dock">
        <WeighInButton
          rows={data.rows}
          today={today}
          className="w-full rounded-full bg-accent px-16 py-12 text-body font-semibold text-accent-ink"
        >
          {loggedToday ? t('editToday') : t('logToday')}
        </WeighInButton>
      </div>
    </>
  )
}
