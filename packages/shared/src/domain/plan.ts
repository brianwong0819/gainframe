import type { PlanDay } from '../schemas/plan.ts'
import type { Workout } from '../schemas/workout.ts'

// The day of a plan to train next: the day after the one followed by the plan's
// latest finished workout, wrapping round to the first day. The rotation follows
// what was done, not the weekday, so a missed day just moves to the next session.
// `days` are the plan's days; deleted days are skipped, and a workout that
// followed a deleted day does not count. Undefined when the plan has no days.
export function nextPlanDay(
  days: readonly PlanDay[],
  workouts: readonly Workout[],
): PlanDay | undefined {
  const rotation = days
    .filter((day) => day.deletedAt === null)
    .toSorted((a, b) => a.position - b.position)
  const index = new Map(rotation.map((day, i) => [day.id, i]))
  let latest: { startedAt: string; index: number } | undefined
  for (const workout of workouts) {
    if (workout.deletedAt !== null || workout.endedAt === null || workout.planDayId === null) {
      continue
    }
    const dayIndex = index.get(workout.planDayId)
    if (dayIndex === undefined) continue
    if (latest === undefined || Date.parse(workout.startedAt) > Date.parse(latest.startedAt)) {
      latest = { startedAt: workout.startedAt, index: dayIndex }
    }
  }
  if (latest === undefined) return rotation[0]
  return rotation[(latest.index + 1) % rotation.length]
}
