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

export interface WorkoutSummaryEntry {
  workout: Workout
  summary: WorkoutSummary
}

// The history list: each finished workout's summary, newest first. As on its
// own summary, a workout's records count against the live workouts that
// started before it, so the record counts match the detail screen.
export function summarizeHistory(input: {
  workouts: readonly Workout[]
  slots: readonly WorkoutExercise[]
  sets: readonly WorkoutSet[]
  load: LoadRules
}): WorkoutSummaryEntry[] {
  const byWorkout = <T extends { workoutId: string }>(rows: readonly T[]) => {
    const groups = new Map<string, T[]>()
    for (const row of rows) {
      const group = groups.get(row.workoutId)
      if (group === undefined) groups.set(row.workoutId, [row])
      else group.push(row)
    }
    return groups
  }
  const slots = byWorkout(input.slots)
  const sets = byWorkout(input.sets.filter((set) => set.deletedAt === null))
  const history: WorkoutSet[] = []
  const entries: WorkoutSummaryEntry[] = []
  const workouts = input.workouts
    .filter((workout) => workout.deletedAt === null)
    .toSorted((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
  for (const workout of workouts) {
    const own = sets.get(workout.id) ?? []
    if (workout.endedAt !== null) {
      const summary = summarizeWorkout({
        workout,
        slots: slots.get(workout.id) ?? [],
        sets: own,
        history,
        load: input.load,
      })
      entries.push({ workout, summary })
    }
    history.push(...own.filter((set) => set.completedAt !== null))
  }
  return entries.reverse()
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
