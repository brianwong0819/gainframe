import { domainConfig } from '../config.ts'
import type { SetKind, Workout, WorkoutSet } from '../schemas/workout.ts'

// Warm-ups are excluded everywhere; drop sets add volume but are too fatigued to
// stand as records.
function countsTowardVolume(kind: SetKind): boolean {
  switch (kind) {
    case 'warmup':
      return false
    case 'working':
    case 'drop':
    case 'failure':
      return true
  }
}

function countsTowardRecords(kind: SetKind): boolean {
  switch (kind) {
    case 'warmup':
    case 'drop':
      return false
    case 'working':
    case 'failure':
      return true
  }
}

function isDone(set: WorkoutSet): boolean {
  return set.deletedAt === null && set.completedAt !== null
}

// Estimated one-rep max (Epley: weight × (1 + reps / 30)), in kg. A single is its
// own 1RM. Null for 0 reps or more reps than `domainConfig.e1rmMaxReps`.
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (reps < 1 || reps > domainConfig.e1rmMaxReps) return null
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

// Total weight × reps of completed, non-deleted sets, warm-ups excluded, in kg.
export function totalVolumeKg(sets: readonly WorkoutSet[]): number {
  return sets
    .filter((set) => isDone(set) && countsTowardVolume(set.kind))
    .reduce((sum, set) => sum + set.weightKg * set.reps, 0)
}

// The completed sets of `exerciseId` from the latest workout that started before
// `before` (an instant), in position order; empty if there is none. Deleted
// workouts and sets are skipped, and so are workouts with no completed set of it.
export function previousPerformance(input: {
  exerciseId: string
  before: string
  workouts: readonly Workout[]
  sets: readonly WorkoutSet[]
}): WorkoutSet[] {
  const cutoff = Date.parse(input.before)
  const setsByWorkout = new Map<string, WorkoutSet[]>()
  for (const set of input.sets) {
    if (set.exerciseId !== input.exerciseId || !isDone(set)) continue
    const list = setsByWorkout.get(set.workoutId) ?? []
    list.push(set)
    setsByWorkout.set(set.workoutId, list)
  }
  const latest = input.workouts
    .filter(
      (workout) =>
        workout.deletedAt === null &&
        Date.parse(workout.startedAt) < cutoff &&
        setsByWorkout.has(workout.id),
    )
    .reduce<Workout | null>(
      (best, workout) =>
        best === null || Date.parse(workout.startedAt) > Date.parse(best.startedAt)
          ? workout
          : best,
      null,
    )
  if (latest === null) return []
  return (setsByWorkout.get(latest.id) ?? []).toSorted((a, b) => a.position - b.position)
}

export type SetValues = Pick<WorkoutSet, 'kind' | 'weightKg' | 'reps'>

// The heaviest weight of an exercise's completed working or failure sets, in kg
// (for a bodyweight exercise, the added load); null if there is none. The
// workout shows it beside the exercise as a target to beat.
export function bestWeightKg(sets: readonly WorkoutSet[]): number | null {
  return sets
    .filter((set) => isDone(set) && countsTowardRecords(set.kind))
    .reduce<number | null>((best, set) => Math.max(best ?? 0, set.weightKg), null)
}

// Values for the next set of an exercise slot. The Nth set takes the Nth set of
// last time (`previous`, from `previousPerformance`); past last time's count it
// repeats the slot's own last set, then last time's last set; an exercise never
// done before starts from `domainConfig.firstSet`. `current` is the slot's sets
// in position order, deleted ones excluded.
export function nextSetValues(
  previous: readonly WorkoutSet[],
  current: readonly WorkoutSet[],
): SetValues {
  const source = previous[current.length] ?? current.at(-1) ?? previous.at(-1)
  if (source === undefined) return { kind: 'working', ...domainConfig.firstSet }
  return { kind: source.kind, weightKg: source.weightKg, reps: source.reps }
}

// IDs of the sets in `current` that set a new estimated-1RM record for their
// exercise. A set is a record when its e1RM beats every earlier counted set: all of
// `history` plus the sets before it in `current` (by completion time). Warm-up and
// drop sets never count, and an exercise with no counted history has no records,
// so a first workout is not a wall of PRs.
export function findPersonalRecords(
  current: readonly WorkoutSet[],
  history: readonly WorkoutSet[],
): Set<string> {
  const best = new Map<string, number>()
  for (const set of history) {
    const e1rm = recordValue(set)
    if (e1rm === null) continue
    best.set(set.exerciseId, Math.max(best.get(set.exerciseId) ?? 0, e1rm))
  }
  const records = new Set<string>()
  const ordered = current
    .filter((set) => recordValue(set) !== null)
    .toSorted((a, b) => Date.parse(a.completedAt ?? '') - Date.parse(b.completedAt ?? ''))
  for (const set of ordered) {
    const e1rm = recordValue(set)
    const previous = best.get(set.exerciseId)
    if (e1rm === null || previous === undefined) continue
    if (e1rm > previous) {
      records.add(set.id)
      best.set(set.exerciseId, e1rm)
    }
  }
  return records
}

function recordValue(set: WorkoutSet): number | null {
  if (!isDone(set) || !countsTowardRecords(set.kind)) return null
  const e1rm = estimateOneRepMax(set.weightKg, set.reps)
  return e1rm === null || e1rm <= 0 ? null : e1rm
}
