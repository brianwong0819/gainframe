import {
  adjustRestEnd,
  bestWeightKg,
  fromKg,
  linkWithNext,
  moveItem,
  nextSetValues,
  previousPerformance,
  restSlotAfter,
  setsTakingWeight,
  sharedValueChanges,
  supersetMembers,
  stepToGrid,
  toKg,
  toLocalDate,
  unlinkFromNext,
  type WeightUnit,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '@gainframe/shared'

import { restResolver } from './exercise-rest'
import type { Repositories } from './repositories'
import type { GainframeDb } from './schema'

// One exercise slot of the active workout, as the screen shows it: its live sets
// in order, last time's completed sets of the same exercise, the heaviest
// weight of the exercise in earlier workouts (null if none), and the completed
// sets of earlier workouts, which a set must beat to be a record.
export interface SlotState {
  slot: WorkoutExercise
  sets: WorkoutSet[]
  previous: WorkoutSet[]
  bestKg: number | null
  earlier: WorkoutSet[]
}

interface ExerciseHistory {
  previous: WorkoutSet[]
  bestKg: number | null
  earlier: WorkoutSet[]
}

export interface ActiveWorkoutState {
  workout: Workout
  slots: SlotState[]
}

const live = (row: { deletedAt: string | null }) => row.deletedAt === null

const noRest = { restStartedAt: null, restEndsAt: null } as const

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
    const earlierIds = new Set(workouts.map((other) => other.id))
    const earlier = sets.filter((set) => earlierIds.has(set.workoutId) && set.completedAt !== null)
    return {
      previous: previousPerformance({ exerciseId, before: workout.startedAt, workouts, sets }),
      bestKg: bestWeightKg(earlier),
      earlier,
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

  // The rest after a set of `slot`, in seconds (0 for none).
  async function restAfter(slot: WorkoutExercise): Promise<number> {
    return (await restResolver(db.exercises))(slot)
  }

  async function liveSlots(workoutId: string): Promise<WorkoutExercise[]> {
    return db.workoutExercises.where('workoutId').equals(workoutId).filter(live).toArray()
  }

  async function clearRest(workout: Workout): Promise<Workout> {
    if (workout.restStartedAt === null) return workout
    return repos.workouts.update(workout.id, noRest)
  }

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
            earlier: history.get(slot.exerciseId)?.earlier ?? [],
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
          ...noRest,
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
          ...noRest,
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
            planNote: item.note,
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
          planNote: null,
        })
        await createSet(slot, workout)
        return slot
      })
    },

    // Appends a set to an exercise slot, prefilled. In a superset it appends a
    // round, a set to every member, so the members keep the same number of
    // sets; returns the first member's new set, where the round starts.
    async addSet(slotId: string): Promise<WorkoutSet> {
      return db.transaction('rw', writeTables, async () => {
        const slot = await repos.workoutExercises.get(slotId)
        if (slot === undefined) throw new Error(`No exercise slot ${slotId}`)
        const workout = await getWorkout(slot.workoutId)
        const added: WorkoutSet[] = []
        for (const member of supersetMembers(await liveSlots(workout.id), slotId)) {
          added.push(await createSet(member, workout))
        }
        const [first] = added
        if (first === undefined) throw new Error(`No live exercise slot ${slotId}`)
        return first
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

    // Steps the weight as shown in `unit` to the next multiple of `step`, so
    // taps land on whole steps (45, 50, 55 lb; 5, 7.5, 10 kg) even from a weight
    // converted from the other unit.
    async stepWeight(
      setId: string,
      step: number,
      direction: -1 | 1,
      unit: WeightUnit,
    ): Promise<WorkoutSet> {
      return db.transaction('rw', db.workoutSets, db.outbox, async () => {
        const set = await getSet(setId)
        const weightKg = toKg(stepToGrid(fromKg(set.weightKg, unit), step, direction), unit)
        return repos.workoutSets.update(setId, { weightKg })
      })
    },

    // Completes a set and, in the same transaction, starts the rest after it:
    // the slot's rest, else the exercise's default. In a superset the rest
    // waits for the end of the round and takes the last member's rest. No
    // rest follows the last set still to do, or an exercise whose rest is 0.
    async completeSet(setId: string): Promise<Workout> {
      return db.transaction('rw', [...writeTables, db.exercises], async () => {
        const at = now()
        const set = await repos.workoutSets.update(setId, { completedAt: at.toISOString() })
        const workout = await getWorkout(set.workoutId)
        const slots = await liveSlots(workout.id)
        const ids = new Set(slots.map(({ id }) => id))
        const sets = (await db.workoutSets.where('workoutId').equals(workout.id).toArray()).filter(
          (other) => live(other) && ids.has(other.workoutExerciseId),
        )
        // A plan day's later sets of a new exercise take this set's weight.
        const sameSlot = sets.filter((other) => other.workoutExerciseId === set.workoutExerciseId)
        for (const { id } of setsTakingWeight(set, sameSlot)) {
          await repos.workoutSets.update(id, { weightKg: set.weightKg })
        }
        const toDo = sets.some((other) => other.completedAt === null)
        const restSlotId = toDo
          ? restSlotAfter(slots, sets, set.workoutExerciseId, set.position)
          : null
        const restSlot = slots.find(({ id }) => id === restSlotId)
        const restS = restSlot === undefined ? 0 : await restAfter(restSlot)
        if (restS === 0) return clearRest(workout)
        return repos.workouts.update(workout.id, {
          restStartedAt: at.toISOString(),
          restEndsAt: new Date(at.getTime() + restS * 1000).toISOString(),
        })
      })
    },

    // Joins an exercise with the one after it into a superset, or splits the
    // superset between them.
    // A new superset starts with the longest rest of its members, which keep
    // it if they are split again, and a member with fewer sets gets sets added
    // until every member has as many as the one with the most.
    async linkWithNext(slotId: string, linked: boolean): Promise<void> {
      await db.transaction('rw', [...writeTables, db.exercises], async () => {
        const slot = await repos.workoutExercises.get(slotId)
        if (slot === undefined) throw new Error(`No exercise slot ${slotId}`)
        const slots = await liveSlots(slot.workoutId)
        const changes = linked ? linkWithNext(slots, slotId) : unlinkFromNext(slots, slotId)
        for (const { id, supersetGroup } of changes) {
          await repos.workoutExercises.update(id, { supersetGroup })
        }
        const restOf = await restResolver(db.exercises)
        const rests = sharedValueChanges(await liveSlots(slot.workoutId), restOf, (s) => s.restS)
        for (const { id, value } of rests) {
          await repos.workoutExercises.update(id, { restS: value })
        }
        if (!linked) return
        const workout = await getWorkout(slot.workoutId)
        const members = supersetMembers(await liveSlots(workout.id), slotId)
        const counts = new Map<string, number>()
        for (const member of members)
          counts.set(member.id, (await slotSets(member.id)).filter(live).length)
        const rounds = Math.max(...counts.values())
        for (const member of members) {
          for (let n = counts.get(member.id) ?? rounds; n < rounds; n += 1) {
            await createSet(member, workout)
          }
        }
      })
    },

    // Sets the rest of a slot's superset, taken after each round, on every
    // member; on the slot alone when it stands alone.
    async setSupersetRest(slotId: string, restS: number): Promise<void> {
      await db.transaction('rw', db.workoutExercises, db.outbox, async () => {
        const slot = await repos.workoutExercises.get(slotId)
        if (slot === undefined) throw new Error(`No exercise slot ${slotId}`)
        for (const { id } of supersetMembers(await liveSlots(slot.workoutId), slotId)) {
          await repos.workoutExercises.update(id, { restS })
        }
      })
    },

    // Moves an exercise one step up (-1) or down (1), keeping supersets
    // together (`moveItem`); the set panel then follows the new order.
    async moveSlot(slotId: string, direction: -1 | 1): Promise<void> {
      await db.transaction('rw', db.workoutExercises, db.outbox, async () => {
        const slot = await repos.workoutExercises.get(slotId)
        if (slot === undefined) throw new Error(`No exercise slot ${slotId}`)
        const slots = await liveSlots(slot.workoutId)
        for (const { id, position } of moveItem(slots, slotId, direction)) {
          await repos.workoutExercises.update(id, { position })
        }
      })
    },

    // Marks a completed set as not done; the rest it started no longer applies.
    async uncompleteSet(setId: string): Promise<Workout> {
      return db.transaction('rw', writeTables, async () => {
        const set = await repos.workoutSets.update(setId, { completedAt: null })
        return clearRest(await getWorkout(set.workoutId))
      })
    },

    // Moves the running rest's end by `deltaS` seconds, never before now.
    async adjustRest(workoutId: string, deltaS: number): Promise<Workout> {
      return db.transaction('rw', db.workouts, db.outbox, async () => {
        const workout = await getWorkout(workoutId)
        if (workout.restEndsAt === null) return workout
        return repos.workouts.update(workoutId, {
          restEndsAt: adjustRestEnd(workout.restEndsAt, deltaS, now().getTime()),
        })
      })
    },

    // Ends the rest: skipped, or its cue dismissed.
    async endRest(workoutId: string): Promise<Workout> {
      return db.transaction('rw', db.workouts, db.outbox, async () =>
        clearRest(await getWorkout(workoutId)),
      )
    },

    async finish(workoutId: string): Promise<Workout> {
      return repos.workouts.update(workoutId, { endedAt: now().toISOString(), ...noRest })
    },
  }
}

export type WorkoutSession = ReturnType<typeof createWorkoutSession>
