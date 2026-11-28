'use client'

import {
  addDays,
  displayWeight,
  type LocalDate,
  type StrengthMeasure,
  type StrengthPoint,
  toLocalDate,
} from '@gainframe/shared'
import { scaleLinear } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { exerciseName, findLibraryEntry, type LibraryEntry } from '@/features/exercises/library'
import { isBodyweight } from '@/features/workout/exercise-info'
import { deviceTimeZone } from '@/i18n/time-zone'
import { Chevron } from '@/ui/chevron'
import { Pressable, PressableLink } from '@/ui/pressable'

import { at } from './strength-chart'
import { SPAN_DAYS, type StrengthData, strengthSpan, useStrengthData } from './use-strength'

// The card lists the most trained exercises first; the rest open on a tap.
const LISTED = 3
const SPARK_W = 72
const SPARK_H = 28
const SPARK_PAD = 4

interface Lift {
  entry: LibraryEntry
  measure: StrengthMeasure
  points: StrengthPoint[]
  // Workouts in the last twelve weeks, for the order.
  recent: number
}

function lifts(data: StrengthData, today: LocalDate): Lift[] {
  const ids = new Set(
    data.sets.filter((set) => set.kind !== 'warmup').map(({ exerciseId }) => exerciseId),
  )
  return [...ids]
    .flatMap((id): Lift[] => {
      const entry = findLibraryEntry(id, data.custom)
      if (entry === undefined) return []
      const measure = isBodyweight(entry.equipment) ? 'reps' : 'e1rm'
      const { all, points } = strengthSpan(data, id, measure, today)
      if (all.length === 0) return []
      const start = addDays(today, 1 - SPAN_DAYS)
      const recent = all.filter(({ localDate }) => localDate >= start).length
      return [{ entry, measure, points, recent }]
    })
    .toSorted(
      (a, b) =>
        b.recent - a.recent ||
        b.points.length - a.points.length ||
        (b.points.at(-1)?.localDate ?? '').localeCompare(a.points.at(-1)?.localDate ?? ''),
    )
}

/**
 * The strength card of the Progress page ("Progress charts" in
 * docs/design-system.md): the most trained exercises, each with its measure
 * (estimated 1RM, or the most reps for a bodyweight exercise), a small line
 * of its best sets, the latest value and the change over the span; each row
 * opens the exercise page. Before any exercise has been done it is the
 * first-days version with a button to the Workout tab.
 */
export function StrengthCard() {
  const t = useTranslations('progress.strength')
  const [today] = useState<LocalDate>(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const [expanded, setExpanded] = useState(false)
  const data = useStrengthData()
  if (data === undefined) return null
  const all = lifts(data, today)

  if (all.length === 0) {
    return (
      <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
        <h2 className="text-label text-ink-2">{t('heading')}</h2>
        <p className="text-body text-ink-2">{t('empty')}</p>
        <PressableLink
          href="/workout"
          className="rounded-full bg-sunk px-16 py-12 text-center text-body font-semibold text-ink"
        >
          {t('start')}
        </PressableLink>
      </section>
    )
  }

  const shown = expanded ? all : all.slice(0, LISTED)
  return (
    <section className="flex flex-col rounded-group bg-surface px-16 pt-16">
      <div className="flex justify-between gap-12 pb-8 text-label text-ink-2">
        <h2>{t('heading')}</h2>
        <span>{t('changeHeading')}</span>
      </div>
      <ul>
        {shown.map((lift) => (
          <LiftRow key={lift.entry.id} lift={lift} data={data} />
        ))}
      </ul>
      {all.length > LISTED && !expanded ? (
        <Pressable
          onClick={() => {
            setExpanded(true)
          }}
          className="flex items-center justify-between gap-12 border-t border-line py-12 text-left text-body font-medium text-ink-2"
        >
          {t('showAll', { count: all.length })}
          <Chevron direction="right" />
        </Pressable>
      ) : (
        <div className="pb-4" />
      )}
    </section>
  )
}

function LiftRow({ lift, data }: { lift: Lift; data: StrengthData }) {
  const t = useTranslations('progress.strength')
  const tWorkout = useTranslations('workout')
  const locale = useLocale()
  const { entry, measure, points } = lift
  const unit = data.units.get(entry.id) ?? 'kg'
  const value = (point: StrengthPoint) =>
    measure === 'reps' ? point.value : displayWeight(point.value, unit)
  const digits = measure === 'e1rm' ? 1 : 0
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  const latest = points.at(-1)
  const first = points[0]
  if (latest === undefined || first === undefined) return null
  const unitText = measure === 'reps' ? t('repsUnit') : tWorkout(`unit.${unit}`)
  const change = value(latest) - value(first)
  const name = exerciseName(entry, locale)

  const x = scaleLinear<number>({
    domain: [at(first.localDate), Math.max(at(latest.localDate), at(first.localDate) + 1)],
    range: [SPARK_PAD, SPARK_W - SPARK_PAD],
  })
  const values = points.map(value)
  const y = scaleLinear<number>({
    domain: [Math.min(...values), Math.max(Math.max(...values), Math.min(...values) + 1)],
    range: [SPARK_H - SPARK_PAD, SPARK_PAD],
  })

  return (
    <li className="border-t border-line">
      <PressableLink
        href={`/progress/exercise#${entry.id}`}
        aria-label={t('rowLabel', { name })}
        className="flex items-center justify-between gap-12 py-12"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body font-semibold">{name}</span>
          <span className="text-label text-ink-2">{t(`measure.${measure}`)}</span>
        </span>
        {points.length > 1 && (
          <svg width={SPARK_W} height={SPARK_H} aria-hidden className="shrink-0">
            <LinePath
              data={points}
              x={({ localDate }) => x(at(localDate))}
              y={(point) => y(value(point))}
              className="fill-none stroke-ink-2"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={x(at(latest.localDate))}
              cy={y(value(latest))}
              r={3.5}
              className={`stroke-surface ${latest.record ? 'fill-accent' : 'fill-ink'}`}
              strokeWidth={1.5}
            />
          </svg>
        )}
        <span className="flex shrink-0 flex-col items-end">
          <span className="num text-body font-semibold">
            {number.format(value(latest))}{' '}
            <span className="text-label font-normal text-ink-2">{unitText}</span>
          </span>
          <span className="num text-label text-ink-2">
            {points.length < 2
              ? t('onceShort')
              : `${change > 0 ? '+' : change < 0 ? '−' : '±'}${number.format(Math.abs(change))} ${unitText}`}
          </span>
        </span>
      </PressableLink>
    </li>
  )
}
