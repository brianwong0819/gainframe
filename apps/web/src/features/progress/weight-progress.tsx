'use client'

import {
  addDays,
  compositionChange,
  dailyWeights,
  type LocalDate,
  targetRange,
  toLocalDate,
  weeklyAverages,
  weeklyRate,
  weighInsNeeded,
  weightTrend,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { weightData } from '@/db/body-metrics'
import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { WeighInButton } from '@/features/body/weigh-in-button'
import { formatShortDay } from '@/features/history/dates'
import { deviceTimeZone } from '@/i18n/time-zone'
import { SegmentedControl } from '@/ui/segmented-control'

import { WeightReadingCard } from './weight-reading-card'

const readWeight = () => weightData(db)

const ranges = ['4w', '12w', 'all'] as const
type Range = (typeof ranges)[number]
const rangeDays: Record<Exclude<Range, 'all'>, number> = { '4w': 28, '12w': 84 }
const WEEKS_LISTED = 5

/**
 * The weight page ("Progress charts" in docs/design-system.md): the range
 * control, the card with the 7-day average and the chart, the weekly
 * averages, the change between two scans, and "Log today's weight" docked at
 * the bottom.
 */
export function WeightProgress() {
  const t = useTranslations('progress.weight')
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
  const data = useLiveQuery(readWeight)
  if (data === undefined) return null

  const days = dailyWeights(data.rows)
  const trend = weightTrend(days)
  const showTrend = weighInsNeeded(days) === 0
  const firstDate = trend[0]?.localDate ?? today
  const from = range === 'all' ? firstDate : addDays(today, 1 - rangeDays[range])
  const points = trend.filter(({ localDate }) => localDate >= from)
  const first = points[0]
  const weekly = weeklyRate(days)
  const wedge =
    showTrend && first !== undefined
      ? targetRange(first.averageKg, first.localDate, [first.localDate, today], data.phase)
      : null
  const weeks = weeklyAverages(days, WEEKS_LISTED)
  const scans = compositionChange(data.rows)
  const loggedToday = data.rows.at(-1)?.localDate === today

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
          }}
          optionLabel={(option) => t(`range.${option}`)}
        />
      )}
      <WeightReadingCard
        key={range}
        points={points}
        latest={trend.at(-1)}
        wedge={wedge}
        weekly={weekly}
        phase={data.phase}
        needed={weighInsNeeded(days)}
        from={from}
        today={today}
        draw={!ranged}
      />

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
