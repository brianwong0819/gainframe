import { domainConfig } from '../config.ts'
import type { BodyMetric } from '../schemas/body-metric.ts'
import type { Phase } from '../schemas/profile.ts'
import type { LocalDate } from '../schemas/row.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const { trendMinWeighIns, targetRatePct } = domainConfig.bodyWeight

type WeighInRow = Pick<BodyMetric, 'localDate' | 'measuredAt' | 'weightKg'>

export interface DailyWeight {
  localDate: LocalDate
  weightKg: number
}

export interface TrendPoint extends DailyWeight {
  // The average of the weigh-ins of the seven days ending on this one.
  averageKg: number
}

export interface WeeklyRate {
  kgPerWeek: number
  // Of the previous week's average.
  pctPerWeek: number
}

export type RateStatus = 'onTarget' | 'tooSlow' | 'tooFast' | 'offTarget'

export interface RangePoint {
  localDate: LocalDate
  lowKg: number
  highKg: number
}

export interface CompositionChange {
  from: LocalDate
  to: LocalDate
  weightKg: number
  leanKg: number
  fatKg: number
}

// Whole days from `from` to `to`; both are local dates, so the arithmetic is
// done at UTC noon and no time zone or daylight-saving shift can move a day.
function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00.000Z`) - Date.parse(`${from}T12:00:00.000Z`)) / DAY_MS,
  )
}

const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

// One weight per day, oldest first: the day's last weigh-in, so a second
// weigh-in that corrects the first replaces it.
export function dailyWeights(rows: readonly WeighInRow[]): DailyWeight[] {
  const byDay = new Map<LocalDate, WeighInRow>()
  for (const row of rows) {
    const kept = byDay.get(row.localDate)
    if (kept === undefined || Date.parse(row.measuredAt) >= Date.parse(kept.measuredAt)) {
      byDay.set(row.localDate, row)
    }
  }
  return [...byDay.values()]
    .map(({ localDate, weightKg }) => ({ localDate, weightKg }))
    .toSorted((a, b) => a.localDate.localeCompare(b.localDate))
}

// Each day's weight with its seven-day average. Days without a weigh-in are
// left out of the average rather than filled in.
export function weightTrend(days: readonly DailyWeight[]): TrendPoint[] {
  return days.map((day) => ({
    ...day,
    averageKg: mean(
      days
        .filter(({ localDate }) => {
          const back = daysBetween(localDate, day.localDate)
          return back >= 0 && back < 7
        })
        .map(({ weightKg }) => weightKg),
    ),
  }))
}

// How many more weigh-ins the trend needs before it is shown.
export function weighInsNeeded(days: readonly DailyWeight[]): number {
  return Math.max(0, trendMinWeighIns - days.length)
}

// The change from the average of the seven days before the last weigh-in's
// week to the average of that week. Null until the trend is shown or when the
// earlier week has no weigh-in.
export function weeklyRate(days: readonly DailyWeight[]): WeeklyRate | null {
  const last = days.at(-1)
  if (last === undefined || weighInsNeeded(days) > 0) return null
  const inWeek = (weeksBack: number) =>
    days
      .filter(({ localDate }) => {
        const back = daysBetween(localDate, last.localDate)
        return back >= weeksBack * 7 && back < (weeksBack + 1) * 7
      })
      .map(({ weightKg }) => weightKg)
  const previous = inWeek(1)
  if (previous.length === 0) return null
  const before = mean(previous)
  const kgPerWeek = mean(inWeek(0)) - before
  return { kgPerWeek, pctPerWeek: (kgPerWeek / before) * 100 }
}

// The target rate for the user's phase; a profile without one is gaining,
// which is what the app is for.
export function targetRate(phase: Phase | null): { min: number; max: number } {
  return targetRatePct[phase ?? 'bulk']
}

// Whether the weekly rate is in the phase's target range. Slow and fast are
// in the phase's direction: a cut losing less than its minimum is too slow.
// Maintaining has no direction, so outside its range is just off target.
export function rateStatus(pctPerWeek: number, phase: Phase | null): RateStatus {
  const { min, max } = targetRate(phase)
  if (pctPerWeek >= min && pctPerWeek <= max) return 'onTarget'
  if (phase === 'maintain') return 'offTarget'
  const belowRange = pctPerWeek < min
  return belowRange === (phase === 'cut') ? 'tooFast' : 'tooSlow'
}

// The target range drawn on the weight chart: a wedge that starts at
// `startKg` on `startDate` and widens at the phase's minimum and maximum
// rates, for each of `dates`.
export function targetRange(
  startKg: number,
  startDate: LocalDate,
  dates: readonly LocalDate[],
  phase: Phase | null,
): RangePoint[] {
  const { min, max } = targetRate(phase)
  return dates.map((localDate) => {
    const weeks = daysBetween(startDate, localDate) / 7
    return {
      localDate,
      lowKg: startKg * (1 + (min / 100) * weeks),
      highKg: startKg * (1 + (max / 100) * weeks),
    }
  })
}

type ScanRow = Pick<
  BodyMetric,
  'localDate' | 'measuredAt' | 'weightKg' | 'bodyFatPct' | 'fatMassKg'
>

// The fat mass a measurement states, or derives from its body fat %; null for
// a weight-only weigh-in.
function fatMass(row: ScanRow): number | null {
  if (row.fatMassKg !== null) return row.fatMassKg
  return row.bodyFatPct === null ? null : (row.weightKg * row.bodyFatPct) / 100
}

// The change in weight, fat-free mass and fat mass from the first to the
// latest measurement with body composition; null with fewer than two. Home
// bioimpedance cannot support a daily trend, so only scans are compared.
export function compositionChange(rows: readonly ScanRow[]): CompositionChange | null {
  const scans = rows
    .flatMap((row) => {
      const fatKg = fatMass(row)
      return fatKg === null ? [] : [{ row, fatKg }]
    })
    .toSorted((a, b) => Date.parse(a.row.measuredAt) - Date.parse(b.row.measuredAt))
  const first = scans.at(0)
  const latest = scans.at(-1)
  if (first === undefined || latest === undefined || scans.length < 2) return null
  const lean = ({ row, fatKg }: { row: ScanRow; fatKg: number }) => row.weightKg - fatKg
  return {
    from: first.row.localDate,
    to: latest.row.localDate,
    weightKg: latest.row.weightKg - first.row.weightKg,
    leanKg: lean(latest) - lean(first),
    fatKg: latest.fatKg - first.fatKg,
  }
}
