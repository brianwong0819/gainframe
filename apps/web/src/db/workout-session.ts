import {
  bestWeightKg,
  fromKg,
  nextSetValues,
  previousPerformance,
  toKg,
  toLocalDate,
  type WeightUnit,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '@gainframe/shared'

import type { Repositories } from './repositories'
import type { GainframeDb } from './schema'

// One exercise slot of the active workout, as the screen shows it: its live sets
// in order, last time's completed sets of the same exercise, and the heaviest
// weight of the exercise in earlier workouts (null if none).
export interface SlotState {
  slot: WorkoutExercise
  sets: WorkoutSet[]
  previous: WorkoutSet[]
  bestKg: number | null
}

interface ExerciseHistory {
  previous: WorkoutSet[]
  bestKg: number | null
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

  // Last time's completed sets of an exercise and its best weight, from the
  // workouts other than `workout` that started before it.
  async function exerciseHistory(exerciseId: string, workout: Workout): Promise<ExerciseHistory> {
    const sets = await db.workoutSets.where('exerciseId').equals(exerciseId).filter(live).toArray()
    const workoutIds = [...new Set(sets.map((set) => set.workoutId))]
    const workouts = (await db.workouts.bulkGet(workoutIds))
      .filter((other) => other !== undefined)
      .filter((other) => other.id !== workout.id && other.startedAt < workout.startedAt)
    const earlier = new Set(workouts.map((other) => other.id))
    return {
      previous: previousPerformance({ exerciseId, before: workout.startedAt, workouts, sets }),
      bestKg: bestWeightKg(sets.filter((set) => earlier.has(set.workoutId))),
    }
  }

  async function slotSets(slotId: string): Promise<WorkoutSet[]> {
    const sets = await db.workoutSets.where('workoutExerciseId').equals(slotId).toArray()
    return sets.toSorted((a, b) => a.position - b.position)
  }

  // A slot from a plan prefills the low end of its rep range; the weight and
  // kind still come from last time.
  async function createSet(slot: WorkoutExercise, workout: Workout): Promise<WorkoutSet> {
    const all = await slotSets(slot.id)
    const { previous } = await exerciseHistory(slot.exerciseId, workout)
    const values = nextSetValues(previous, all.filter(live))
    return repos.workoutSets.create({
      workoutExerciseId: slot.id,
      workoutId: slot.workoutId,
      exerciseId: slot.exerciseId,
      position: nextPosition(all),
      ...values,
      reps: slot.repsMin ?? values.reps,
      rpe: null,
      completedAt: null,
    })
  }

  async function getWorkout(id: string): Promise<Workout> {
    const workout = await repos.workouts.get(id)
    if (workout === undefined) throw new Error(`No workout ${id}`)
    return workout
  }

  async function getSet(id: string): Promise<WorkoutSet> {
    const set = await repos.workoutSets.get(id)
    if (set === undefined) throw new Error(`No set ${id}`)
    return set
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
      const history = new Map<string, ExerciseHistory>()
      for (const { exerciseId } of slots) {
        if (!history.has(exerciseId)) {
          history.set(exerciseId, await exerciseHistory(exerciseId, workout))
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
            previous: history.get(slot.exerciseId)?.previous ?? [],
            bestKg: history.get(slot.exerciseId)?.bestKg ?? null,
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
          planDayId: null,
          localDate: toLocalDate(startedAt, timeZone),
          note: null,
        })
      })
    },

    // Resumes the workout in progress, or starts one from a plan day: its
    // exercises in order, each with its target number of sets, prefilled.
    async startFromPlanDay(dayId: string, timeZone: string): Promise<Workout> {
      const tables = [...writeTables, db.planDays, db.planItems]
      return db.transaction('rw', tables, async () => {
        const active = await findActive()
        if (active !== undefined) return active
        const day = await repos.planDays.get(dayId)
        if (day === undefined) throw new Error(`No plan day ${dayId}`)
        const items = await db.planItems.where('planDayId').equals(dayId).filter(live).toArray()
        const startedAt = now().toISOString()
        const workout = await repos.workouts.create({
          startedAt,
          endedAt: null,
          planDayId: dayId,
          localDate: toLocalDate(startedAt, timeZone),
          note: null,
        })
        const ordered = items.toSorted((a, b) => a.position - b.position)
        for (const [position, item] of ordered.entries()) {
          const slot = await repos.workoutExercises.create({
            workoutId: workout.id,
            exerciseId: item.exerciseId,
            position,
            supersetGroup: item.supersetGroup,
            note: null,
            repsMin: item.repsMin,
            repsMax: item.repsMax,
            restS: item.restS,
          })
          for (let n = 0; n < item.targetSets; n += 1) await createSet(slot, workout)
        }
        return workout
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
          repsMin: null,
          repsMax: null,
          restS: null,
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

    // Moves a set's weight or reps by `delta`, never below 0, reading the stored
    // value in the same transaction so quick taps all count.
    async stepReps(setId: string, delta: number): Promise<WorkoutSet> {
      return db.transaction('rw', db.workoutSets, db.outbox, async () => {
        const set = await getSet(setId)
        return repos.workoutSets.update(setId, { reps: Math.max(0, set.reps + delta) })
      })
    },

    // Steps the weight as shown in `unit`, so taps in pounds land on whole
    // steps of pounds (45, 50, 55 lb) rather than on converted kg.
    async stepWeight(setId: string, delta: number, unit: WeightUnit): Promise<WorkoutSet> {
      return db.transaction('rw', db.workoutSets, db.outbox, async () => {
        const set = await getSet(setId)
        const weightKg = toKg(Math.max(0, fromKg(set.weightKg, unit) + delta), unit)
        return repos.workoutSets.update(setId, { weightKg })
      })
    },

    async finish(workoutId: string): Promise<Workout> {
      return repos.workouts.update(workoutId, { endedAt: now().toISOString() })
    },
  }
}

export type WorkoutSession = ReturnType<typeof createWorkoutSession>
