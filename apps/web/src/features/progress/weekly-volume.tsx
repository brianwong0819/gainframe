'use client'

import {
  averageFullWeeks,
  type LocalDate,
  toLocalDate,
  type WeekVolume,
  weeklyVolume,
} from '@gainframe/shared'
import { motion } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { loadRules } from '@/db/workout-summary'
import { formatShortDay } from '@/features/history/dates'
import { deviceTimeZone } from '@/i18n/time-zone'
import { fade } from '@/ui/motion'
import { useWidth } from '@/ui/plot'
import { Pressable } from '@/ui/pressable'
import { RollingNumber } from '@/ui/rolling-number'
import { SegmentedControl } from '@/ui/segmented-control'
import { Verdict } from '@/ui/verdict'

import { BAR_RADIUS, barPath } from './day-bars'

const readVolumeData = async () => {
  const [workouts, sets, custom] = await Promise.all([
    db.workouts.filter((workout) => workout.deletedAt === null).toArray(),
    db.workoutSets.filter((set) => set.deletedAt === null && set.completedAt !== null).toArray(),
    db.exercises.toArray(),
  ])
  return { workouts, sets, custom }
}

const measures = ['sets', 'kg'] as const
type Measure = (typeof measures)[number]
const HEIGHT = 150
const MAX_BAR_W = 16

const valueOf: Record<Measure, (week: WeekVolume) => number> = {
  sets: ({ sets }) => sets,
  kg: ({ volumeKg }) => volumeKg,
}

/**
 * The volume page's weekly bars ("Progress charts" in docs/design-system.md):
 * twelve weeks, Monday to Sunday, in working sets (the default) or kg; the
 * week in progress in `--accent`, a hairline at the average of the last full
 * weeks. A tap selects a week, which the header shows and the muscle section
 * below switches to; `selected` is the index into the weeks, null for none.
 */
export function WeeklyVolume({
  selected,
  onSelect,
}: {
  selected: number | null
  onSelect: (index: number | null, week: WeekVolume | null) => void
}) {
  const t = useTranslations('progress.weekly')
  const locale = useLocale()
  const [today] = useState<LocalDate>(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const [measure, setMeasure] = useState<Measure>('sets')
  const [switched, setSwitched] = useState(false)
  const [box, width] = useWidth()
  const data = useLiveQuery(readVolumeData)
  if (data === undefined) return null

  const weeks = weeklyVolume({ ...data, load: loadRules(data.custom), today })
  const value = valueOf[measure]
  const average = averageFullWeeks(weeks, value)
  const current = weeks.length - 1
  const index = selected ?? current
  const week = weeks[index]
  if (week === undefined) return null

  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: measure === 'sets' ? 1 : 0,
  })
  const unit = t(`unit.${measure}`)
  const format = (shown: number) => `${number.format(shown)} ${unit}`
  const max = Math.max(...weeks.map(value), average ?? 0, 1)
  const pitch = width / weeks.length
  const barW = Math.max(2, Math.min(MAX_BAR_W, pitch - 6))
  const y = (shown: number) => HEIGHT - (shown / max) * (HEIGHT - BAR_RADIUS)
  const shown = value(week)
  const inProgress = index === current
  const label = inProgress
    ? t('thisWeek')
    : t('weekOf', { date: formatShortDay(week.from, locale) })
  const gap = average === null ? null : shown - average

  let verdict
  if (inProgress) {
    verdict = (
      <Verdict tone="plain" word={t('notOver')}>
        {average === null ? t('noAverage') : t('average', { value: format(average) })}
      </Verdict>
    )
  } else if (gap !== null && average !== null) {
    verdict = (
      <Verdict
        tone="plain"
        word={
          Math.abs(gap) < 0.5
            ? t('atAverage')
            : gap > 0
              ? t('aboveAverage', { value: format(gap) })
              : t('belowAverage', { value: format(-gap) })
        }
      >
        {t('average', { value: format(average) })}
      </Verdict>
    )
  }

  return (
    <>
      <SegmentedControl
        label={t('measureLabel')}
        options={measures}
        value={measure}
        onChange={(next) => {
          setMeasure(next)
          setSwitched(true)
        }}
        optionLabel={(option) => t(`measure.${option}`)}
      />
      <section className="flex flex-col gap-4 rounded-group bg-surface p-16">
        <h2 className="text-label text-ink-2">{label}</h2>
        <p className="flex items-baseline gap-4 pt-4">
          <span className="num text-title">
            <RollingNumber value={number.format(shown)} />
          </span>
          <span className="text-label text-ink-2">{unit}</span>
        </p>
        {verdict}
        <motion.div
          key={measure}
          className="relative mt-8"
          style={{ height: HEIGHT }}
          ref={box}
          initial={switched ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={fade}
        >
          {width > 0 && (
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={t('chartLabel')}
              className="block"
            >
              <line x1={0} x2={width} y1={HEIGHT} y2={HEIGHT} className="stroke-line" />
              {weeks.map((each, at) => {
                const top = y(value(each))
                const fill =
                  at === index && selected !== null
                    ? 'fill-ink'
                    : at === current
                      ? 'fill-accent'
                      : 'fill-ink-3'
                return value(each) > 0 ? (
                  <path
                    key={each.from}
                    d={barPath(at * pitch + (pitch - barW) / 2, barW, top, HEIGHT)}
                    className={fill}
                  />
                ) : null
              })}
              {average !== null && (
                <line
                  x1={0}
                  x2={width}
                  y1={y(average)}
                  y2={y(average)}
                  className="stroke-ink-2"
                  strokeWidth={1}
                />
              )}
            </svg>
          )}
          <div className="absolute inset-0 flex touch-pan-y">
            {weeks.map((each, at) => (
              <Pressable
                key={each.from}
                aria-pressed={selected === at}
                aria-label={t('barLabel', {
                  date: formatShortDay(each.from, locale),
                  value: format(value(each)),
                })}
                onClick={() => {
                  if (selected === at) onSelect(null, null)
                  else onSelect(at, each)
                }}
                className="h-full flex-1"
              />
            ))}
          </div>
        </motion.div>
        <div className="flex justify-between pt-4 text-caption text-ink-2">
          <span>{t('weekOf', { date: formatShortDay(weeks[0]?.from ?? week.from, locale) })}</span>
          <span>{t('thisWeekShort')}</span>
        </div>
        <p className="pt-8 text-label font-normal text-ink-2">{t(`footnote.${measure}`)}</p>
      </section>
    </>
  )
}
