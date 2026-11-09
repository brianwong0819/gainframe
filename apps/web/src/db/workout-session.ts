import {
  nextSetValues,
  previousPerformance,
  toLocalDate,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '@gainframe/shared'

import type { Repositories } from './repositories'
import type { GainframeDb } from './schema'

// One exercise slot of the active workout, as the screen shows it: its live sets
// in order and last time's completed sets of the same exercise.
export interface SlotState {
  slot: WorkoutExercise
  sets: WorkoutSet[]
  previous: WorkoutSet[]
}

export interface ActiveWorkoutState {
  workout: Workout
  slots: SlotState[]
}

const live = (row: { deletedAt: string | null }) => row.deletedAt === null

function nextPosition(rows: readonly { position: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.position + 1), 0)
}

// The workout in progress and the writes that log it. Every change goes through
// the repositories, so each completed set is stored, with its outbox entry, the
// moment it is completed; iOS may end a backgrounded home-screen app at any time.
export function createWorkoutSession(
  db: GainframeDb,
  repos: Repositories,
  now: () => Date = () => new Date(),
) {
  // The latest workout that has not ended. Only one is started at a time; if a
  // second ever appears (two devices after sync), the latest one is resumed.
  async function findActive(): Promise<Workout | undefined> {
    return db.workouts
      .orderBy('startedAt')
      .reverse()
      .filter((workout) => live(workout) && workout.endedAt === null)
      .first()
  }

  // Last time's completed sets of an exercise, before the given instant.
  async function previousSets(exerciseId: string, before: string): Promise<WorkoutSet[]> {
    const sets = await db.workoutSets.where('exerciseId').equals(exerciseId).filter(live).toArray()
    const workoutIds = [...new Set(sets.map((set) => set.workoutId))]
    const workouts = (await db.workouts.bulkGet(workoutIds)).filter(
      (workout) => workout !== undefined,
    )
    return previousPerformance({ exerciseId, before, workouts, sets })
  }

  async function slotSets(slotId: string): Promise<WorkoutSet[]> {
    const sets = await db.workoutSets.where('workoutExerciseId').equals(slotId).toArray()
    return sets.toSorted((a, b) => a.position - b.position)
  }

  async function createSet(slot: WorkoutExercise, workout: Workout): Promise<WorkoutSet> {
    const all = await slotSets(slot.id)
    const previous = await previousSets(slot.exerciseId, workout.startedAt)
    return repos.workoutSets.create({
      workoutExerciseId: slot.id,
      workoutId: slot.workoutId,
      exerciseId: slot.exerciseId,
      position: nextPosition(all),
      ...nextSetValues(previous, all.filter(live)),
      rpe: null,
      completedAt: null,
    })
  }

  async function getWorkout(id: string): Promise<Workout> {
    const workout = await repos.workouts.get(id)
    if (workout === undefined) throw new Error(`No workout ${id}`)
    return workout
  }

  const writeTables = [db.workouts, db.workoutExercises, db.workoutSets, db.outbox]

  return {
    findActive,

    // Everything the active workout screen shows; null when no workout is open.
    async loadActive(): Promise<ActiveWorkoutState | null> {
      const workout = await findActive()
      if (workout === undefined) return null
      const slots = await db.workoutExercises
        .where('workoutId')
        .equals(workout.id)
        .filter(live)
        .toArray()
      const sets = await db.workoutSets.where('workoutId').equals(workout.id).filter(live).toArray()
      const previous = new Map<string, WorkoutSet[]>()
      for (const { exerciseId } of slots) {
        if (!previous.has(exerciseId)) {
          previous.set(exerciseId, await previousSets(exerciseId, workout.startedAt))
        }
      }
      return {
        workout,
        slots: slots
          .toSorted((a, b) => a.position - b.position)
          .map((slot) => ({
            slot,
            sets: sets
              .filter((set) => set.workoutExerciseId === slot.id)
              .toSorted((a, b) => a.position - b.position),
            previous: previous.get(slot.exerciseId) ?? [],
          })),
      }
    },

    // Resumes the workout in progress, or starts an empty one.
    async start(timeZone: string): Promise<Workout> {
      return db.transaction('rw', db.workouts, db.outbox, async () => {
        const active = await findActive()
        if (active !== undefined) return active
        const startedAt = now().toISOString()
        return repos.workouts.create({
          startedAt,
          endedAt: null,
          templateId: null,
          localDate: toLocalDate(startedAt, timeZone),
          note: null,
        })
      })
    },

    // Appends an exercise to the workout with its first set, prefilled.
    async addExercise(workoutId: string, exerciseId: string): Promise<WorkoutExercise> {
      return db.transaction('rw', writeTables, async () => {
        const workout = await getWorkout(workoutId)
        const slots = await db.workoutExercises.where('workoutId').equals(workoutId).toArray()
        const slot = await repos.workoutExercises.create({
          workoutId,
          exerciseId,
          position: nextPosition(slots),
          supersetGroup: null,
          note: null,
        })
        await createSet(slot, workout)
        return slot
      })
    },

    // Appends a set to an exercise slot, prefilled.
    async addSet(slotId: string): Promise<WorkoutSet> {
      return db.transaction('rw', writeTables, async () => {
        const slot = await repos.workoutExercises.get(slotId)
        if (slot === undefined) throw new Error(`No exercise slot ${slotId}`)
        return createSet(slot, await getWorkout(slot.workoutId))
      })
    },

    async finish(workoutId: string): Promise<Workout> {
      return repos.workouts.update(workoutId, { endedAt: now().toISOString() })
    },
  }
}

export type WorkoutSession = ReturnType<typeof createWorkoutSession>
