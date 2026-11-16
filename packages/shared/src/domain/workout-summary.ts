import { domainConfig } from '../config.ts'
import type { Workout, WorkoutExercise, WorkoutSet } from '../schemas/workout.ts'
import { findPersonalRecords, type LoadRules, type RecordKind, totalVolumeKg } from './workout.ts'

export interface ExerciseSummary {
  slot: WorkoutExercise
  // The completed sets, warm-ups included, in the order they were done.
  sets: WorkoutSet[]
  setsDone: number
  volumeKg: number
  // The heaviest completed working or failure set, most reps first among equal
  // weights; null when the slot has none.
  topSet: WorkoutSet | null
  // This slot's record sets in the order they were done.
  records: { set: WorkoutSet; kinds: RecordKind[] }[]
}

export interface WorkoutSummary {
  // Null while the workout has not ended; see `durationS` for a workout left
  // open long after its last set.
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
      sets,
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
    durationS: durationS(workout, done),
    volumeKg: exercises.reduce((sum, exercise) => sum + exercise.volumeKg, 0),
    setsDone: exercises.reduce((sum, exercise) => sum + exercise.setsDone, 0),
    recordCount: exercises.reduce((sum, exercise) => sum + exercise.records.length, 0),
    exercises,
  }
}

export interface SummaryComparison {
  // The change in volume as a fraction of the earlier volume (0.25 = a quarter
  // more); null when the earlier workout had none.
  volumeChange: number | null
  // By exercise: this workout's top-set weight minus the earlier one's, in kg,
  // for the exercises both workouts have a top set of.
  topWeightDeltaKg: Map<string, number>
}

// How a workout did against an earlier one, normally the last time the same
// plan day was done.
export function compareSummaries(
  current: WorkoutSummary,
  earlier: WorkoutSummary,
): SummaryComparison {
  const earlierTop = new Map(
    earlier.exercises.flatMap(({ slot, topSet }) =>
      topSet === null ? [] : [[slot.exerciseId, topSet.weightKg] as const],
    ),
  )
  const topWeightDeltaKg = new Map<string, number>()
  for (const { slot, topSet } of current.exercises) {
    const before = earlierTop.get(slot.exerciseId)
    if (topSet !== null && before !== undefined) {
      topWeightDeltaKg.set(slot.exerciseId, topSet.weightKg - before)
    }
  }
  return {
    volumeChange:
      earlier.volumeKg > 0 ? (current.volumeKg - earlier.volumeKg) / earlier.volumeKg : null,
    topWeightDeltaKg,
  }
}

export interface WorkoutSummaryEntry {
  workout: Workout
  summary: WorkoutSummary
}

// The history list: each finished workout with at least one completed set,
// newest first. As on its
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
      if (summary.setsDone > 0) entries.push({ workout, summary })
    }
    history.push(...own.filter((set) => set.completedAt !== null))
  }
  return entries.reverse()
}

export interface RecentRecord {
  set: WorkoutSet
  workout: Workout
}

// The latest record set of each exercise, newest workout first, at most
// `limit` of them. `entries` are newest first, as `summarizeHistory` returns
// them; an exercise appears once, with its most recent record.
export function recentRecords(
  entries: readonly WorkoutSummaryEntry[],
  limit: number,
): RecentRecord[] {
  const seen = new Set<string>()
  const found: RecentRecord[] = []
  for (const { workout, summary } of entries) {
    for (const { slot, records } of summary.exercises) {
      const latest = records.at(-1)
      if (latest === undefined || seen.has(slot.exerciseId)) continue
      seen.add(slot.exerciseId)
      found.push({ set: latest.set, workout })
    }
  }
  return found.slice(0, limit)
}

// From the start to the finish; but a finish more than
// `domainConfig.forgottenFinishS` after the last completed set means the
// workout was left open, so it ends at that set instead.
function durationS(workout: Workout, done: readonly WorkoutSet[]): number | null {
  if (workout.endedAt === null) return null
  const started = Date.parse(workout.startedAt)
  const ended = Date.parse(workout.endedAt)
  const lastSet = Math.max(...done.map((set) => Date.parse(set.completedAt ?? '')))
  const end = ended - lastSet > domainConfig.forgottenFinishS * 1000 ? lastSet : ended
  return Math.round((end - started) / 1000)
}

// Each exercise's best set among `sets`, by exercise id: its heaviest working
// or failure set, most reps first among equal weights. `sets` are completed
// sets that are not deleted; an exercise with only warm-ups has no entry.
export function bestSets(sets: readonly WorkoutSet[]): Map<string, WorkoutSet> {
  const best = new Map<string, WorkoutSet>()
  for (const [exerciseId, own] of Map.groupBy(sets, (set) => set.exerciseId)) {
    const top = topSet(own)
    if (top !== null) best.set(exerciseId, top)
  }
  return best
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
