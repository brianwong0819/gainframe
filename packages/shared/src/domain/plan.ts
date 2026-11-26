import type { Plan, PlanDay, PlanItem } from '../schemas/plan.ts'
import type { Workout, WorkoutExercise, WorkoutSet } from '../schemas/workout.ts'

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

export type PlanItemValues = Pick<
  PlanItem,
  | 'exerciseId'
  | 'position'
  | 'supersetGroup'
  | 'targetSets'
  | 'repsMin'
  | 'repsMax'
  | 'restS'
  | 'note'
>

// A finished workout as the items of a new plan day: each exercise in order,
// with as many target sets as completed working or failure sets, and the range
// of their reps as the rep range. Warm-ups, drop sets and sets not done are
// left out, and so is an exercise with none of those sets.
export function planItemsFromWorkout(
  slots: readonly WorkoutExercise[],
  sets: readonly WorkoutSet[],
): PlanItemValues[] {
  return slots
    .filter((slot) => slot.deletedAt === null)
    .toSorted((a, b) => a.position - b.position)
    .flatMap((slot) => {
      const reps = sets
        .filter(
          (set) =>
            set.workoutExerciseId === slot.id &&
            set.deletedAt === null &&
            set.completedAt !== null &&
            (set.kind === 'working' || set.kind === 'failure'),
        )
        .map((set) => Math.min(100, Math.max(1, set.reps)))
      if (reps.length === 0) return []
      return [
        {
          exerciseId: slot.exerciseId,
          supersetGroup: slot.supersetGroup,
          targetSets: Math.min(20, reps.length),
          repsMin: Math.min(...reps),
          repsMax: Math.max(...reps),
          restS: slot.restS,
          note: slot.planNote,
        },
      ]
    })
    .map((item, position) => ({ ...item, position }))
}

// The active plan: of the live plans, the one made active most recently.
// Undefined when no live plan has been made active.
export function activePlanOf(plans: readonly Plan[]): Plan | undefined {
  return plans.reduce<Plan | undefined>((latest, plan) => {
    if (plan.deletedAt !== null || plan.activatedAt === null) return latest
    return latest?.activatedAt != null && latest.activatedAt >= plan.activatedAt ? latest : plan
  }, undefined)
}
