import {
  BUILT_IN_EXERCISES,
  type Exercise,
  type LoadRules,
  summarizeWorkout,
  type Workout,
  type WorkoutSummary,
} from '@gainframe/shared'

import type { GainframeDb } from './schema'

const builtInBodyweight = BUILT_IN_EXERCISES.filter(
  ({ equipment }) => equipment === 'bodyweight',
).map(({ id }) => id)

const live = (row: { deletedAt: string | null }) => row.deletedAt === null

// Which exercises are bodyweight, built-in or custom (`custom` includes deleted
// ones, since past workouts keep them). The body weight is unknown until M4-02.
export function loadRules(custom: readonly Exercise[]): LoadRules {
  const bodyweight = new Set([
    ...builtInBodyweight,
    ...custom.filter(({ equipment }) => equipment === 'bodyweight').map(({ id }) => id),
  ])
  return { isBodyweight: (exerciseId) => bodyweight.has(exerciseId), bodyWeightKg: null }
}

export interface WorkoutSummaryState {
  workout: Workout
  summary: WorkoutSummary
}

// A workout's summary for the finish screen and history; null when the
// workout does not exist or was deleted. Every read is a direct Dexie call, so
// a live query observes all of them (L-026).
export async function loadWorkoutSummary(
  db: GainframeDb,
  workoutId: string,
): Promise<WorkoutSummaryState | null> {
  const workout = await db.workouts.get(workoutId)
  if (workout === undefined || !live(workout)) return null
  const slots = await db.workoutExercises.where('workoutId').equals(workoutId).toArray()
  const sets = await db.workoutSets.where('workoutId').equals(workoutId).toArray()
  const exerciseIds = [...new Set(slots.filter(live).map(({ exerciseId }) => exerciseId))]
  // The completed sets of the same exercises in other workouts, kept below
  // when those workouts are live and started earlier.
  const others = await db.workoutSets
    .where('exerciseId')
    .anyOf(exerciseIds)
    .filter((set) => live(set) && set.completedAt !== null && set.workoutId !== workoutId)
    .toArray()
  const otherWorkouts = await db.workouts.bulkGet([...new Set(others.map((set) => set.workoutId))])
  const custom = await db.exercises.toArray()
  const earlier = new Set(
    otherWorkouts.flatMap((other) =>
      other !== undefined && live(other) && other.startedAt < workout.startedAt ? [other.id] : [],
    ),
  )
  const summary = summarizeWorkout({
    workout,
    slots,
    sets,
    history: others.filter((set) => earlier.has(set.workoutId)),
    load: loadRules(custom),
  })
  return { workout, summary }
}
