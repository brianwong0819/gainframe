import { domainConfig } from '../config.ts'
import { type LocalDate, localDateSchema } from '../schemas/row.ts'
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

export interface WeekSummary {
  // Monday to Sunday.
  dates: LocalDate[]
  // The dates of the week with a finished workout.
  trained: LocalDate[]
  workouts: number
  setsDone: number
  volumeKg: number
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
    workouts: inWeek.length,
    setsDone: inWeek.reduce((sum, { summary }) => sum + summary.setsDone, 0),
    volumeKg: inWeek.reduce((sum, { summary }) => sum + summary.volumeKg, 0),
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
