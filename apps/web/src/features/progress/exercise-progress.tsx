'use client'

import {
  addDays,
  displayWeight,
  type LocalDate,
  type StrengthMeasure,
  type StrengthPoint,
  strengthHistory,
  toLocalDate,
  type WeightUnit,
  type WorkoutSet,
} from '@gainframe/shared'
import { motion } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'

import { findLibraryEntry, exerciseName } from '@/features/exercises/library'
import { formatDay, formatShortDay } from '@/features/history/dates'
import { formatSetWeight, isBodyweight } from '@/features/workout/exercise-info'
import { deviceTimeZone } from '@/i18n/time-zone'
import { BackLink } from '@/ui/back-link'
import { fade } from '@/ui/motion'
import { PressableLink } from '@/ui/pressable'
import { RollingNumber } from '@/ui/rolling-number'
import { SegmentedControl } from '@/ui/segmented-control'
import { Verdict } from '@/ui/verdict'

import { StrengthChart, StrengthLegend } from './strength-chart'
import { type StrengthData, strengthSpan, useStrengthData } from './use-strength'

const weightMeasures = ['e1rm', 'heaviest'] as const
const RECENT_LISTED = 5

// How a set's load reads ("70 kg", "+10 kg", or the bodyweight label), and the whole set
// ("70 kg × 6").
function useSetText(unit: WeightUnit, bodyweight: boolean) {
  const tWorkout = useTranslations('workout')
  const load = (set: WorkoutSet) => {
    const weight = formatSetWeight(set.weightKg, unit, bodyweight, tWorkout('bodyweight'))
    return bodyweight && set.weightKg === 0 ? weight : `${weight} ${tWorkout(`unit.${unit}`)}`
  }
  return { load, set: (set: WorkoutSet) => `${load(set)} × ${set.reps.toString()}` }
}

/**
 * The exercise page ("Progress charts" in docs/design-system.md):
 * `/progress/exercise#<exercise id>`. A control between estimated 1RM and the
 * heaviest set (a bodyweight exercise shows the most reps only), the card with
 * the latest value and the chart, the exercise's bests, and its recent workouts.
 */
export function ExerciseProgress({ exerciseId }: { exerciseId: string | null }) {
  const t = useTranslations('progress.strength')
  const tProgress = useTranslations('progress')
  const tMuscle = useTranslations('muscle')
  const tEquipment = useTranslations('equipment')
  const locale = useLocale()
  const [today] = useState<LocalDate>(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const [picked, setPicked] = useState<StrengthMeasure>('e1rm')
  const [switched, setSwitched] = useState(false)
  const data = useStrengthData()
  const back = <BackLink href="/progress" label={tProgress('title')} />
  if (data === undefined) return back

  const entry = exerciseId === null ? undefined : findLibraryEntry(exerciseId, data.custom)
  if (entry === undefined || exerciseId === null) {
    return (
      <>
        {back}
        <p className="text-body text-ink-2">{t('notFound')}</p>
      </>
    )
  }
  const bodyweight = isBodyweight(entry.equipment)
  const measure: StrengthMeasure = bodyweight ? 'reps' : picked
  const unit = data.units.get(exerciseId) ?? 'kg'
  const span = strengthSpan(data, exerciseId, measure, today)
  const count = span.all.length

  return (
    <>
      <header className="flex flex-col gap-8">
        {back}
        <h1 className="text-title">{exerciseName(entry, locale)}</h1>
        <p className="-mt-4 text-label text-ink-2">
          {tMuscle(entry.muscle)} · {tEquipment(entry.equipment)}
          {count > 0 && ` · ${t('workouts', { count })}`}
        </p>
      </header>
      {!bodyweight && count > 1 && (
        <SegmentedControl
          label={t('measureLabel')}
          options={weightMeasures}
          value={picked === 'reps' ? 'e1rm' : picked}
          onChange={(next) => {
            setPicked(next)
            setSwitched(true)
          }}
          optionLabel={(option) => t(`measure.${option}`)}
        />
      )}
      <StrengthReadingCard
        key={measure}
        points={span.points}
        from={span.from}
        today={today}
        measure={measure}
        unit={unit}
        bodyweight={bodyweight}
        draw={!switched}
      />
      {count > 0 && (
        <ExerciseBests
          data={data}
          exerciseId={exerciseId}
          count={count}
          unit={unit}
          bodyweight={bodyweight}
        />
      )}
      {count > 0 && (
        <RecentWorkouts
          points={span.all}
          measure={measure}
          unit={unit}
          bodyweight={bodyweight}
          locale={locale}
        />
      )}
    </>
  )
}

function useValueFormat(measure: StrengthMeasure, unit: WeightUnit) {
  const locale = useLocale()
  const tWorkout = useTranslations('workout')
  const t = useTranslations('progress.strength')
  const [tenth] = useState(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  )
  const [plain] = useState(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }))
  // A point's value in the shown unit: kg or lb, or reps.
  const value = useCallback(
    (point: StrengthPoint) => (measure === 'reps' ? point.value : displayWeight(point.value, unit)),
    [measure, unit],
  )
  const format = useCallback(
    (shown: number) => (measure === 'e1rm' ? tenth.format(shown) : plain.format(shown)),
    [measure, tenth, plain],
  )
  const unitText = measure === 'reps' ? t('repsUnit') : tWorkout(`unit.${unit}`)
  return { value, format, unitText }
}

/**
 * The page's main card: the latest value with a verdict line (the set it
 * comes from and the change since the first workout shown), the chart and its
 * legend. Reading the chart puts that workout in the header. The reading lives
 * here, so a drag re-renders this card only; a new measure mounts a new card.
 */
function StrengthReadingCard({
  points,
  from,
  today,
  measure,
  unit,
  bodyweight,
  draw,
}: {
  points: readonly StrengthPoint[]
  from: LocalDate
  today: LocalDate
  measure: StrengthMeasure
  unit: WeightUnit
  bodyweight: boolean
  draw: boolean
}) {
  const t = useTranslations('progress.strength')
  const locale = useLocale()
  const { set: setText } = useSetText(unit, bodyweight)
  const { value, format, unitText } = useValueFormat(measure, unit)
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

  const latest = points.at(-1)
  if (latest === undefined) {
    return (
      <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
        <p className="text-body text-ink-2">{t('none')}</p>
        <PressableLink
          href="/workout"
          className="rounded-full bg-sunk px-16 py-12 text-center text-body font-semibold text-ink"
        >
          {t('start')}
        </PressableLink>
      </section>
    )
  }

  const first = points[0] ?? latest
  const read = reading === null ? undefined : points[reading]
  const shown = read ?? latest
  const change = value(latest) - value(first)
  const signed = `${change > 0 ? '+' : change < 0 ? '−' : '±'}${format(Math.abs(change))}`
  const date = (day: LocalDate) => (day === today ? t('today') : formatShortDay(day, locale))

  let label
  let sub
  if (read !== undefined) {
    label = read.record
      ? t('readingRecord', { date: formatDay(read.localDate, locale) })
      : formatDay(read.localDate, locale)
    sub = <p className="num text-label text-ink-2">{setText(read.set)}</p>
  } else if (points.length < 2) {
    label = t('latestLabel', { measure: t(`measure.${measure}`), date: date(latest.localDate) })
    sub = <p className="text-label text-ink-2">{t('needMore')}</p>
  } else {
    label = t('latestLabel', { measure: t(`measure.${measure}`), date: date(latest.localDate) })
    sub = (
      <Verdict tone={change > 0 ? 'ok' : 'plain'} word={change > 0 ? t('rising') : t('notRising')}>
        {setText(latest.set)} · {t('since', { date: formatShortDay(first.localDate, locale) })}{' '}
        {signed} {unitText}
      </Verdict>
    )
  }

  return (
    <section className="flex flex-col gap-4 rounded-group bg-surface p-16">
      <h2 className="text-label text-ink-2">{label}</h2>
      <p className="flex items-baseline gap-4 pt-4">
        <span className="num text-title">
          {read === undefined ? (
            <RollingNumber value={format(value(shown))} />
          ) : (
            format(value(shown))
          )}
        </span>
        <span className="text-label text-ink-2">{unitText}</span>
      </p>
      {sub}
      {points.length > 1 && (
        <>
          <motion.div
            className="pt-8"
            initial={draw ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={fade}
          >
            <StrengthChart
              points={points}
              value={value}
              from={from}
              to={today}
              xLabels={xLabels}
              yFormat={format}
              reading={reading}
              onRead={setReading}
              draw={draw}
            />
          </motion.div>
          <div className="pt-8">
            <StrengthLegend />
          </div>
        </>
      )}
    </section>
  )
}

// The heaviest set, the most reps and the workout count, over all workouts.
function ExerciseBests({
  data,
  exerciseId,
  count,
  unit,
  bodyweight,
}: {
  data: StrengthData
  exerciseId: string
  count: number
  unit: WeightUnit
  bodyweight: boolean
}) {
  const t = useTranslations('progress.strength')
  const tWorkout = useTranslations('workout')
  const { load } = useSetText(unit, bodyweight)
  const weight = (set: WorkoutSet) =>
    formatSetWeight(set.weightKg, unit, bodyweight, tWorkout('bodyweight'))
  const unitText = tWorkout(`unit.${unit}`)
  const best = (measure: StrengthMeasure) =>
    strengthHistory({ exerciseId, workouts: data.workouts, sets: data.sets, measure }).reduce<
      StrengthPoint | undefined
    >((top, point) => (top === undefined || point.value > top.value ? point : top), undefined)
  const heaviest = best('heaviest')
  const reps = best('reps')
  const heavy = heaviest?.set
  const items = [
    {
      key: 'heaviest',
      value: heavy === undefined ? '–' : weight(heavy),
      unit: heavy === undefined || (bodyweight && heavy.weightKg === 0) ? '' : unitText,
      detail: '',
    },
    {
      key: 'mostReps',
      value: reps === undefined ? '–' : reps.set.reps.toString(),
      unit: t('repsUnit'),
      detail: reps === undefined ? '' : `× ${load(reps.set)}`,
    },
    { key: 'count', value: count.toString(), unit: t('timesUnit'), detail: '' },
  ] as const
  return (
    <section className="rounded-group bg-surface p-16">
      <dl className="grid grid-cols-3 gap-12">
        {items.map((item) => (
          <div key={item.key} className="flex min-w-0 flex-col-reverse">
            <dt className="text-label text-ink-2">{t(`bests.${item.key}`)}</dt>
            <dd className="flex flex-col">
              <span className="flex items-baseline gap-4 whitespace-nowrap">
                <span className="num text-section">{item.value}</span>
                <span className="text-label text-ink-2">{item.unit}</span>
              </span>
              {item.detail !== '' && (
                <span className="num text-label text-ink-2">{item.detail}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// The latest workouts as a list, newest first: the date, a record tag, the
// best set and its value by the measure, so nothing is readable only by
// touching the chart.
function RecentWorkouts({
  points,
  measure,
  unit,
  bodyweight,
  locale,
}: {
  points: readonly StrengthPoint[]
  measure: StrengthMeasure
  unit: WeightUnit
  bodyweight: boolean
  locale: string
}) {
  const t = useTranslations('progress.strength')
  const { set: setText } = useSetText(unit, bodyweight)
  const { value, format } = useValueFormat(measure, unit)
  const recent = points.slice(-RECENT_LISTED).toReversed()
  return (
    <section className="rounded-group bg-surface px-16 pt-16 pb-4">
      <div className="flex justify-between gap-12 pb-8 text-label text-ink-2">
        <h2>{t('recent')}</h2>
        <span>{t(`measure.${measure}`)}</span>
      </div>
      <ul>
        {recent.map((point) => (
          <li
            key={point.workoutId}
            className="flex items-center justify-between gap-12 border-t border-line py-12"
          >
            <span className="flex items-center gap-8 text-body">
              {formatShortDay(point.localDate, locale)}
              {point.record && (
                <span className="rounded-full bg-accent-wash px-8 text-label text-accent">
                  {t('record')}
                </span>
              )}
            </span>
            <span className="flex items-baseline gap-16">
              <span className="num text-label text-ink-2">{setText(point.set)}</span>
              {measure !== 'reps' && (
                <span className="num min-w-40 text-right text-body font-semibold">
                  {format(value(point))}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
