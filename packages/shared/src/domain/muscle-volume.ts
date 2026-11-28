import { domainConfig } from '../config.ts'
import { type MuscleGroup, muscleGroupSchema } from '../schemas/exercise.ts'
import type { LocalDate } from '../schemas/row.ts'
import type { Workout, WorkoutSet } from '../schemas/workout.ts'

/** The groups a set can count for; a full-body exercise counts only through its secondary muscles. */
export type TrainedMuscle = Exclude<MuscleGroup, 'full_body'>

export const TRAINED_MUSCLES: readonly TrainedMuscle[] = muscleGroupSchema.options.filter(
  (muscle): muscle is TrainedMuscle => muscle !== 'full_body',
)

export interface MuscleContribution {
  exerciseId: string
  // Completed sets of the exercise in the range.
  sets: number
  // 1 for the primary muscle, `secondaryShare` for a secondary one.
  share: number
}

export interface MuscleVolume {
  // Sets counted for the group: each contribution's sets times its share.
  sets: number
  // Sets of exercises whose primary muscle is the group.
  directSets: number
  // Most sets first.
  contributions: MuscleContribution[]
}

/** The muscle map's fill: 0 untrained, 1 under the effective band, 2 effective, 3 the target zone or more. */
export type MuscleHeat = 0 | 1 | 2 | 3

export type MuscleZone = 'none' | 'indirect' | 'low' | 'effective' | 'target' | 'high'

/**
 * Sets per muscle group for the workouts dated `from` to `to` (both included).
 * Only completed sets count, and never a warm-up. Exercises missing from
 * `muscles` (deleted from the library) count for nothing.
 */
export function muscleVolume(input: {
  workouts: readonly Pick<Workout, 'id' | 'localDate' | 'deletedAt'>[]
  sets: readonly Pick<
    WorkoutSet,
    'workoutId' | 'exerciseId' | 'kind' | 'completedAt' | 'deletedAt'
  >[]
  muscles: ReadonlyMap<string, { muscle: MuscleGroup; secondaryMuscles: readonly MuscleGroup[] }>
  from: LocalDate
  to: LocalDate
}): Record<TrainedMuscle, MuscleVolume> {
  const inRange = new Set(
    input.workouts
      .filter((w) => w.deletedAt === null && w.localDate >= input.from && w.localDate <= input.to)
      .map((w) => w.id),
  )
  const setsByExercise = new Map<string, number>()
  for (const set of input.sets) {
    if (set.deletedAt !== null || set.completedAt === null || set.kind === 'warmup') continue
    if (!inRange.has(set.workoutId)) continue
    setsByExercise.set(set.exerciseId, (setsByExercise.get(set.exerciseId) ?? 0) + 1)
  }

  const empty = (): MuscleVolume => ({ sets: 0, directSets: 0, contributions: [] })
  const result: Record<TrainedMuscle, MuscleVolume> = {
    chest: empty(),
    back: empty(),
    shoulders: empty(),
    biceps: empty(),
    triceps: empty(),
    forearms: empty(),
    quads: empty(),
    hamstrings: empty(),
    glutes: empty(),
    calves: empty(),
    core: empty(),
  }
  const { secondaryShare } = domainConfig.muscleVolume
  for (const [exerciseId, sets] of setsByExercise) {
    const exercise = input.muscles.get(exerciseId)
    if (!exercise) continue
    if (exercise.muscle !== 'full_body') {
      const group = result[exercise.muscle]
      group.sets += sets
      group.directSets += sets
      group.contributions.push({ exerciseId, sets, share: 1 })
    }
    for (const muscle of exercise.secondaryMuscles) {
      if (muscle === 'full_body') continue
      result[muscle].sets += sets * secondaryShare
      result[muscle].contributions.push({ exerciseId, sets, share: secondaryShare })
    }
  }
  for (const group of Object.values(result)) {
    group.contributions.sort((a, b) => b.sets * b.share - a.sets * a.share)
  }
  return result
}

/**
 * The groups trained as a primary muscle in a range, normally the last
 * `directDays` days: only they can read as low.
 */
export function trainedDirectly(volume: Record<TrainedMuscle, MuscleVolume>): Set<TrainedMuscle> {
  return new Set(TRAINED_MUSCLES.filter((muscle) => volume[muscle].directSets > 0))
}

/**
 * A group's zone for a week's sets. Under the effective band, a group not
 * trained directly in the last weeks reads `indirect` rather than `low`, so a
 * lifter who never trains a muscle on purpose is not told off for it.
 */
export function muscleZone(sets: number, trainedDirectly: boolean): MuscleZone {
  const { effective, target, high } = domainConfig.muscleVolume.zones
  if (sets === 0) return 'none'
  if (sets < effective) return trainedDirectly ? 'low' : 'indirect'
  if (sets < target) return 'effective'
  if (sets <= high) return 'target'
  return 'high'
}

/** The muscle map's fill for a group's sets. */
export function muscleHeat(sets: number): MuscleHeat {
  const { effective, target } = domainConfig.muscleVolume.zones
  if (sets === 0) return 0
  if (sets < effective) return 1
  if (sets < target) return 2
  return 3
}

/**
 * The group the volume section opens on: among the groups trained directly,
 * the one furthest below the target zone; with none below it, the group with
 * the most sets; with nothing trained, the first group.
 */
export function startingMuscle(
  volume: Record<TrainedMuscle, MuscleVolume>,
  trainedDirectly: ReadonlySet<TrainedMuscle>,
): TrainedMuscle {
  const { target } = domainConfig.muscleVolume.zones
  const below = TRAINED_MUSCLES.filter(
    (muscle) => trainedDirectly.has(muscle) && volume[muscle].sets < target,
  )
  const pick = (candidates: readonly TrainedMuscle[], better: (a: number, b: number) => boolean) =>
    candidates.reduce<TrainedMuscle | null>(
      (best, muscle) =>
        best === null || better(volume[muscle].sets, volume[best].sets) ? muscle : best,
      null,
    )
  return (
    pick(below, (a, b) => a < b) ??
    pick(
      TRAINED_MUSCLES.filter((muscle) => volume[muscle].sets > 0),
      (a, b) => a > b,
    ) ??
    'chest'
  )
}
