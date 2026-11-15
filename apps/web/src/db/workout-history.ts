import { summarizeHistory } from '@gainframe/shared'

import type { GainframeDb } from './schema'
import { loadRules, type WorkoutSummaryState } from './workout-summary'

// Every finished workout, newest first, for the history list. Every read is a
// direct Dexie call, so a live query observes all of them (L-026).
export async function loadWorkoutHistory(db: GainframeDb): Promise<WorkoutSummaryState[]> {
  const workouts = await db.workouts.toArray()
  const slots = await db.workoutExercises.toArray()
  const sets = await db.workoutSets.toArray()
  const custom = await db.exercises.toArray()
  const days = new Map((await db.planDays.toArray()).map((day) => [day.id, day.name]))
  return summarizeHistory({ workouts, slots, sets, load: loadRules(custom) }).map((entry) => ({
    ...entry,
    dayName: entry.workout.planDayId === null ? null : (days.get(entry.workout.planDayId) ?? null),
  }))
}
