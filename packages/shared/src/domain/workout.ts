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

// How the load of a set is counted. A bodyweight exercise stores only the added
// load in `weightKg`; its volume adds `bodyWeightKg` when the user's body weight
// is known (M4-02) and counts the added load alone until then.
export interface LoadRules {
  isBodyweight: (exerciseId: string) => boolean
  bodyWeightKg: number | null
}

// Total load × reps of completed, non-deleted sets, warm-ups excluded, in kg.
export function totalVolumeKg(sets: readonly WorkoutSet[], rules: LoadRules): number {
  return sets
    .filter((set) => isDone(set) && countsTowardVolume(set.kind))
    .reduce((sum, set) => {
      const bodyKg = rules.isBodyweight(set.exerciseId) ? (rules.bodyWeightKg ?? 0) : 0
      return sum + (set.weightKg + bodyKg) * set.reps
    }, 0)
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

// The sets that take the weight of a set just completed: the later sets of its
// slot that are not done and still at `domainConfig.firstSet.weightKg`, the
// weight a set starts at when the exercise was never done. A plan day lays
// out all its sets before any weight is known, so without this each set of a
// new exercise is typed again. A set that already has a weight, from last time
// or typed by the user, is never changed. `slotSets` are the slot's live sets.
export function setsTakingWeight(done: WorkoutSet, slotSets: readonly WorkoutSet[]): WorkoutSet[] {
  const unset = domainConfig.firstSet.weightKg
  if (done.weightKg === unset) return []
  return slotSets.filter(
    (set) => set.position > done.position && set.completedAt === null && set.weightKg === unset,
  )
}

// The sets that follow a done set whose weight is corrected (`before` is the
// set as stored before the edit): the later sets of its slot that are not done
// and still at the old weight, which they were most likely prefilled with or
// carried from it. A set with any other weight was chosen on purpose and is
// left alone, as is everything when the edited set is not done, because its
// later sets are then edited one by one in the set panel.
export function setsFollowingWeight(
  before: WorkoutSet,
  slotSets: readonly WorkoutSet[],
): WorkoutSet[] {
  if (before.completedAt === null) return []
  return slotSets.filter(
    (set) =>
      set.position > before.position &&
      set.completedAt === null &&
      set.weightKg === before.weightKg,
  )
}

// e1rm: a higher estimated 1RM than any earlier set. reps: more reps than any
// earlier set at the same or a higher weight, which also covers sets above
// `domainConfig.e1rmMaxReps` (for a bodyweight exercise, the added load is the
// weight).
export type RecordKind = 'e1rm' | 'reps'

// The sets in `current` that set a new record for their exercise, with the kinds
// they set, in that order. Each set is compared with every earlier counted set:
// all of `history` plus the sets before it in `current` (by completion time).
// Warm-up and drop sets never count; an exercise with no counted history has no
// records, so a first workout is not a wall of PRs. A bodyweight exercise has
// only rep records, since an e1RM of the added load alone means nothing.
export function findPersonalRecords(
  current: readonly WorkoutSet[],
  history: readonly WorkoutSet[],
  isBodyweight: (exerciseId: string) => boolean,
): Map<string, RecordKind[]> {
  const earlier = new Map<string, WorkoutSet[]>()
  // Appends in place: history summaries pass every earlier set of an exercise.
  const remember = (set: WorkoutSet) => {
    const sets = earlier.get(set.exerciseId)
    if (sets === undefined) earlier.set(set.exerciseId, [set])
    else sets.push(set)
  }
  history.filter(countsAsRecord).forEach(remember)
  const records = new Map<string, RecordKind[]>()
  const ordered = current
    .filter(countsAsRecord)
    .toSorted((a, b) => Date.parse(a.completedAt ?? '') - Date.parse(b.completedAt ?? ''))
  for (const set of ordered) {
    const before = earlier.get(set.exerciseId) ?? []
    const kinds: RecordKind[] = []
    if (!isBodyweight(set.exerciseId) && beatsE1rm(set, before)) kinds.push('e1rm')
    if (before.length > 0 && beatsReps(set, before)) kinds.push('reps')
    if (kinds.length > 0) records.set(set.id, kinds)
    remember(set)
  }
  return records
}

function countsAsRecord(set: WorkoutSet): boolean {
  return isDone(set) && countsTowardRecords(set.kind) && set.reps > 0
}

function positiveE1rm(set: WorkoutSet): number | null {
  const e1rm = estimateOneRepMax(set.weightKg, set.reps)
  return e1rm === null || e1rm <= 0 ? null : e1rm
}

// Needs an earlier e1RM to beat: sets above the rep limit have none.
function beatsE1rm(set: WorkoutSet, before: readonly WorkoutSet[]): boolean {
  const e1rm = positiveE1rm(set)
  const best = before.reduce<number | null>((max, other) => {
    const value = positiveE1rm(other)
    return value === null ? max : Math.max(max ?? 0, value)
  }, null)
  return e1rm !== null && best !== null && e1rm > best
}

function beatsReps(set: WorkoutSet, before: readonly WorkoutSet[]): boolean {
  return before.every((other) => other.weightKg < set.weightKg || other.reps < set.reps)
}
