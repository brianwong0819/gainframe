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
  // The plan and day the workout followed, deleted ones included so past
  // workouts keep their names; null for a workout started empty.
  planName: string | null
  dayName: string | null
}

// A workout's summary with the summary of the last time the same plan day was
// done before it; `previous` is null for a workout started empty and for a
// day's first time.
export interface WorkoutSummaryDetail extends WorkoutSummaryState {
  previous: WorkoutSummary | null
}

// The latest finished workout of the same plan day that started before
// `workout`, summarised without records (it is only compared with).
async function previousOfDay(
  db: GainframeDb,
  workout: Workout,
  load: LoadRules,
): Promise<WorkoutSummary | null> {
  if (workout.planDayId === null) return null
  const sameDay = await db.workouts.where('planDayId').equals(workout.planDayId).toArray()
  const previous = sameDay
    .filter((other) => live(other) && other.endedAt !== null)
    .filter((other) => other.startedAt < workout.startedAt)
    .toSorted((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  if (previous === undefined) return null
  const slots = await db.workoutExercises.where('workoutId').equals(previous.id).toArray()
  const sets = await db.workoutSets.where('workoutId').equals(previous.id).toArray()
  return summarizeWorkout({ workout: previous, slots, sets, history: [], load })
}

// A workout's summary for the finish screen and history; null when the
// workout does not exist or was deleted. Every read is a direct Dexie call, so
// a live query observes all of them (L-026).
export async function loadWorkoutSummary(
  db: GainframeDb,
  workoutId: string,
): Promise<WorkoutSummaryDetail | null> {
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
  const load = loadRules(custom)
  const summary = summarizeWorkout({
    workout,
    slots,
    sets,
    history: others.filter((set) => earlier.has(set.workoutId)),
    load,
  })
  const day = workout.planDayId === null ? undefined : await db.planDays.get(workout.planDayId)
  const plan = day === undefined ? undefined : await db.plans.get(day.planId)
  return {
    workout,
    summary,
    planName: plan?.name ?? null,
    dayName: day?.name ?? null,
    previous: await previousOfDay(db, workout, load),
  }
}
