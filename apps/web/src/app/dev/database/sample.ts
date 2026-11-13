import { type Exercise, toLocalDate } from '@gainframe/shared'

import type { NewRow, Repositories } from '@/db/repositories'
import type { GainframeDb } from '@/db/schema'

// The dev page writes its samples to this database, never to the app's own, so a
// sample workout cannot show up as history, last time's numbers or a record.
export const SAMPLE_DB_NAME = 'gainframe-dev-sample'

const sampleExercise: NewRow<Exercise> = {
  nameZh: '杠铃卧推',
  nameEn: 'Barbell bench press',
  muscle: 'chest',
  secondaryMuscles: ['shoulders', 'triceps'],
  equipment: 'barbell',
  defaultRestS: 120,
}

export async function logSampleWorkout(repos: Repositories, now: Date): Promise<void> {
  const at = now.toISOString()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const exercise = await repos.exercises.create(sampleExercise)
  const workout = await repos.workouts.create({
    startedAt: at,
    endedAt: null,
    planDayId: null,
    localDate: toLocalDate(at, timeZone),
    note: null,
    restStartedAt: null,
    restEndsAt: null,
  })
  const slot = await repos.workoutExercises.create({
    workoutId: workout.id,
    exerciseId: exercise.id,
    position: 0,
    supersetGroup: null,
    note: null,
    repsMin: null,
    repsMax: null,
    restS: null,
    planNote: null,
  })
  for (const [position, weightKg] of [60, 62.5, 65].entries()) {
    await repos.workoutSets.create({
      workoutExerciseId: slot.id,
      workoutId: workout.id,
      exerciseId: exercise.id,
      position,
      kind: 'working',
      weightKg,
      reps: 8,
      rpe: null,
      completedAt: at,
    })
  }
}

export interface RemovedSamples {
  exercises: number
  workouts: number
}

// Before samples had their own database (M1-04 review), the page wrote them to
// the app's database. Soft-deletes those rows there: custom exercises identical
// to the sample one, and workouts whose every set uses such an exercise. A
// workout that also holds other exercises is kept, and so is its exercise.
export async function removeSamplesFromAppDb(
  db: GainframeDb,
  repos: Repositories,
): Promise<RemovedSamples> {
  const exercises = await db.exercises
    .filter(
      (exercise) =>
        exercise.deletedAt === null &&
        exercise.nameZh === sampleExercise.nameZh &&
        exercise.nameEn === sampleExercise.nameEn &&
        exercise.muscle === sampleExercise.muscle &&
        exercise.equipment === sampleExercise.equipment &&
        exercise.defaultRestS === sampleExercise.defaultRestS,
    )
    .toArray()
  const exerciseIds = new Set(exercises.map((exercise) => exercise.id))
  const sampleSets = await db.workoutSets
    .where('exerciseId')
    .anyOf([...exerciseIds])
    .toArray()
  const workoutIds = new Set(sampleSets.map((set) => set.workoutId))

  let workouts = 0
  for (const workoutId of workoutIds) {
    const sets = await db.workoutSets
      .where('workoutId')
      .equals(workoutId)
      .filter((set) => set.deletedAt === null)
      .toArray()
    if (sets.every((set) => exerciseIds.has(set.exerciseId))) {
      if ((await repos.workouts.get(workoutId)) !== undefined) workouts += 1
      await repos.workouts.remove(workoutId)
    }
  }
  // An exercise still used by a kept workout stays, so that workout keeps its names.
  let removedExercises = 0
  for (const id of exerciseIds) {
    const used = await db.workoutSets
      .where('exerciseId')
      .equals(id)
      .filter((set) => set.deletedAt === null)
      .count()
    if (used === 0) {
      await repos.exercises.remove(id)
      removedExercises += 1
    }
  }
  return { exercises: removedExercises, workouts }
}
