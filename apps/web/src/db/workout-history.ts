import { summarizeHistory } from '@gainframe/shared'

import type { GainframeDb } from './schema'
import { loadRules, type WorkoutSummaryState } from './workout-summary'

// Every finished workout with a completed set, newest first, for the history
// list. Every read is a
// direct Dexie call, so a live query observes all of them (L-026).
export async function loadWorkoutHistory(db: GainframeDb): Promise<WorkoutSummaryState[]> {
  const workouts = await db.workouts.toArray()
  const slots = await db.workoutExercises.toArray()
  const sets = await db.workoutSets.toArray()
  const custom = await db.exercises.toArray()
  const days = new Map((await db.planDays.toArray()).map((day) => [day.id, day]))
  const plans = new Map((await db.plans.toArray()).map((plan) => [plan.id, plan.name]))
  return summarizeHistory({ workouts, slots, sets, load: loadRules(custom) }).map((entry) => {
    const day = entry.workout.planDayId === null ? undefined : days.get(entry.workout.planDayId)
    return {
      ...entry,
      planName: day === undefined ? null : (plans.get(day.planId) ?? null),
      dayName: day?.name ?? null,
    }
  })
}

// How many workouts the history list shows, for the Workout tab, without
// summarising them.
export async function countHistory(db: GainframeDb): Promise<number> {
  const finished = await db.workouts
    .filter((workout) => workout.deletedAt === null && workout.endedAt !== null)
    .primaryKeys()
  const done = await db.workoutSets
    .filter((set) => set.deletedAt === null && set.completedAt !== null)
    .toArray()
  const withSets = new Set(done.map(({ workoutId }) => workoutId))
  return finished.filter((id) => withSets.has(id)).length
}
