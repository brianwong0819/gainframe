import type { Workout, WorkoutExercise, WorkoutSet } from '../schemas/workout.ts'
import { findPersonalRecords, type LoadRules, type RecordKind, totalVolumeKg } from './workout.ts'

export interface ExerciseSummary {
  slot: WorkoutExercise
  setsDone: number
  volumeKg: number
  // The heaviest completed working or failure set, most reps first among equal
  // weights; null when the slot has none.
  topSet: WorkoutSet | null
  // This slot's record sets in the order they were done.
  records: { set: WorkoutSet; kinds: RecordKind[] }[]
}

export interface WorkoutSummary {
  // Null while the workout has not ended.
  durationS: number | null
  volumeKg: number
  setsDone: number
  recordCount: number
  exercises: ExerciseSummary[]
}

// The figures shown when a workout ends and in its history entry: duration,
// volume, completed sets (warm-ups included) and records, overall and per
// exercise slot in slot order. `sets` are the workout's own sets; `history` the
// earlier sets of the same exercises (see `findPersonalRecords`).
export function summarizeWorkout(input: {
  workout: Workout
  slots: readonly WorkoutExercise[]
  sets: readonly WorkoutSet[]
  history: readonly WorkoutSet[]
  load: LoadRules
}): WorkoutSummary {
  const { workout, load } = input
  const liveSlots = input.slots
    .filter((slot) => slot.deletedAt === null)
    .toSorted((a, b) => a.position - b.position)
  const done = input.sets.filter((set) => set.deletedAt === null && set.completedAt !== null)
  const records = findPersonalRecords(done, input.history, load.isBodyweight)
  const exercises = liveSlots.map((slot): ExerciseSummary => {
    const sets = done
      .filter((set) => set.workoutExerciseId === slot.id)
      .toSorted((a, b) => Date.parse(a.completedAt ?? '') - Date.parse(b.completedAt ?? ''))
    return {
      slot,
      setsDone: sets.length,
      volumeKg: totalVolumeKg(sets, load),
      topSet: topSet(sets),
      records: sets.flatMap((set) => {
        const kinds = records.get(set.id)
        return kinds === undefined ? [] : [{ set, kinds }]
      }),
    }
  })
  return {
    durationS:
      workout.endedAt === null
        ? null
        : Math.round((Date.parse(workout.endedAt) - Date.parse(workout.startedAt)) / 1000),
    volumeKg: exercises.reduce((sum, exercise) => sum + exercise.volumeKg, 0),
    setsDone: exercises.reduce((sum, exercise) => sum + exercise.setsDone, 0),
    recordCount: exercises.reduce((sum, exercise) => sum + exercise.records.length, 0),
    exercises,
  }
}

function topSet(sets: readonly WorkoutSet[]): WorkoutSet | null {
  return sets
    .filter((set) => set.kind === 'working' || set.kind === 'failure')
    .reduce<WorkoutSet | null>(
      (best, set) =>
        best === null ||
        set.weightKg > best.weightKg ||
        (set.weightKg === best.weightKg && set.reps > best.reps)
          ? set
          : best,
      null,
    )
}
