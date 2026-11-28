import { domainConfig } from '../config.ts'
import { type LocalDate, localDateSchema } from '../schemas/row.ts'
import type { Workout, WorkoutSet } from '../schemas/workout.ts'
import { addDays } from './nutrition.ts'
import { type LoadRules, totalVolumeKg } from './workout.ts'
import type { WorkoutSummaryEntry } from './workout-summary.ts'

const DAY_MS = 24 * 60 * 60 * 1000

// The seven local dates, Monday to Sunday, of the week `today` falls in. This is
// calendar arithmetic on a date that is already local, done in UTC so no time
// zone or daylight-saving shift can move a day.
export function weekDates(today: LocalDate): LocalDate[] {
  const noon = Date.parse(`${today}T12:00:00.000Z`)
  const sinceMonday = (new Date(noon).getUTCDay() + 6) % 7
  return Array.from({ length: 7 }, (_, index) =>
    localDateSchema.parse(
      new Date(noon + (index - sinceMonday) * DAY_MS).toISOString().slice(0, 10),
    ),
  )
}

export interface WorkoutTotals {
  workouts: number
  setsDone: number
  volumeKg: number
}

// What a list of finished workouts adds up to: a week, or a month of history.
export function totalWorkouts(entries: readonly WorkoutSummaryEntry[]): WorkoutTotals {
  return {
    workouts: entries.length,
    setsDone: entries.reduce((sum, { summary }) => sum + summary.setsDone, 0),
    volumeKg: entries.reduce((sum, { summary }) => sum + summary.volumeKg, 0),
  }
}

export interface WeekSummary extends WorkoutTotals {
  // Monday to Sunday.
  dates: LocalDate[]
  // The dates of the week with a finished workout.
  trained: LocalDate[]
}

// What the finished workouts of `today`'s week add up to. A workout counts for
// its own `localDate`, the day it was started on in the user's time zone.
export function summarizeWeek(
  entries: readonly WorkoutSummaryEntry[],
  today: LocalDate,
): WeekSummary {
  const dates = weekDates(today)
  const inWeek = entries.filter(({ workout }) => dates.includes(workout.localDate))
  return {
    dates,
    trained: dates.filter((date) => inWeek.some(({ workout }) => workout.localDate === date)),
    ...totalWorkouts(inWeek),
  }
}

// The latest finished workout of a plan day; null when it was never done.
export function lastOfPlanDay(
  entries: readonly WorkoutSummaryEntry[],
  planDayId: string,
): WorkoutSummaryEntry | null {
  return (
    entries
      .filter(({ workout }) => workout.planDayId === planDayId)
      .toSorted((a, b) => Date.parse(b.workout.startedAt) - Date.parse(a.workout.startedAt))[0] ??
    null
  )
}

// A rough length for a planned day: each set takes `domainConfig.setWorkS` and
// is followed by its rest.
export function estimateDurationS(items: readonly { sets: number; restS: number }[]): number {
  return items.reduce((sum, { sets, restS }) => sum + sets * (domainConfig.setWorkS + restS), 0)
}

export interface WeekVolume {
  // Monday and Sunday of the week.
  from: LocalDate
  to: LocalDate
  // Completed sets other than warm-ups.
  sets: number
  // As `totalVolumeKg` counts it.
  volumeKg: number
}

// The volume page's weekly bars ("Progress charts" in docs/design-system.md):
// `domainConfig.weeklyVolume.weeks` weeks, Monday to Sunday, oldest first,
// ending with the week `today` falls in. A set counts for its workout's
// `localDate`; deleted workouts and sets, unfinished sets and warm-ups are
// left out. Every exercise counts, those without a muscle group included.
export function weeklyVolume(input: {
  workouts: readonly Workout[]
  sets: readonly WorkoutSet[]
  load: LoadRules
  today: LocalDate
}): WeekVolume[] {
  const { weeks } = domainConfig.weeklyVolume
  const monday = weekDates(input.today)[0] ?? input.today
  const dayOf = new Map(
    input.workouts
      .filter((workout) => workout.deletedAt === null)
      .map((workout) => [workout.id, workout.localDate]),
  )
  const counted = input.sets.filter(
    (set) =>
      set.deletedAt === null &&
      set.completedAt !== null &&
      set.kind !== 'warmup' &&
      dayOf.has(set.workoutId),
  )
  return Array.from({ length: weeks }, (_, index) => {
    const from = addDays(monday, (index - weeks + 1) * 7)
    const to = addDays(from, 6)
    const own = counted.filter((set) => {
      const day = dayOf.get(set.workoutId)
      return day !== undefined && day >= from && day <= to
    })
    return { from, to, sets: own.length, volumeKg: totalVolumeKg(own, input.load) }
  })
}

// The average of `value` over the full weeks before the current one (the
// last entry of `weeks`), up to `domainConfig.weeklyVolume.averageWeeks` of
// them, counting weeks without a workout as zero but not the weeks before the
// first workout; null when no full week has a workout.
export function averageFullWeeks(
  weeks: readonly WeekVolume[],
  value: (week: WeekVolume) => number,
): number | null {
  const full = weeks.slice(0, -1).slice(-domainConfig.weeklyVolume.averageWeeks)
  const first = full.findIndex((week) => week.sets > 0)
  if (first === -1) return null
  const counted = full.slice(first)
  return counted.reduce((sum, week) => sum + value(week), 0) / counted.length
}
