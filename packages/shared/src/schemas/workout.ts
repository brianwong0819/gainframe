import { z } from 'zod'

import { restSecondsSchema } from './exercise.ts'
import { instantSchema, localDateSchema, syncedRowSchema } from './row.ts'

export const workoutSchema = syncedRowSchema
  .extend({
    startedAt: instantSchema,
    endedAt: instantSchema.nullable(),
    // The plan day this workout followed; null for a workout started empty.
    planDayId: z.uuid().nullable(),
    localDate: localDateSchema,
    note: z.string().max(2000).nullable(),
  })
  .refine(
    (workout) =>
      workout.endedAt === null || Date.parse(workout.endedAt) >= Date.parse(workout.startedAt),
    { message: 'A workout cannot end before it starts', path: ['endedAt'] },
  )

// warmup: preparation, never counted. working: a normal set. drop: a reduced-weight
// set straight after another. failure: a working set taken to failure.
// The unit a weight is shown and typed in. Weights are always stored in kg;
// some gyms label plates and machine stacks in pounds.
export const weightUnitSchema = z.enum(['kg', 'lb'])

export const setKindSchema = z.enum(['warmup', 'working', 'drop', 'failure'])

// One exercise slot in a workout, mirroring a plan item: its order in the
// workout, its superset group (items sharing a group alternate; null means
// standalone) and the user's note for that exercise in this workout. The same
// exercise may appear twice in one workout as two slots. A slot started from a
// plan copies the item's rep range and rest, so later edits to the plan do not
// change past workouts; all three are null for an exercise added by hand, and
// `restS` is also null when the item uses the exercise's default rest.
export const workoutExerciseSchema = syncedRowSchema
  .extend({
    workoutId: z.uuid(),
    exerciseId: z.uuid(),
    position: z.int().min(0),
    supersetGroup: z.int().min(0).nullable(),
    note: z.string().max(500).nullable(),
    repsMin: z.int().min(1).max(100).nullable(),
    repsMax: z.int().min(1).max(100).nullable(),
    restS: restSecondsSchema.nullable(),
  })
  .refine(
    (slot) => slot.repsMin === null || slot.repsMax === null || slot.repsMin <= slot.repsMax,
    { message: 'The rep range cannot end below its start', path: ['repsMax'] },
  )

// One set. `completedAt` is null while the set is planned but not yet done.
// `workoutId` and `exerciseId` copy the slot's values when the set is created and
// never change, so history and "last time" can query sets by exercise directly.
// `position` orders the sets within their slot. For a bodyweight exercise
// `weightKg` is the added load (0 = bodyweight only).
export const workoutSetSchema = syncedRowSchema.extend({
  workoutExerciseId: z.uuid(),
  workoutId: z.uuid(),
  exerciseId: z.uuid(),
  position: z.int().min(0),
  kind: setKindSchema,
  weightKg: z.number().min(0).max(1000),
  reps: z.int().min(0).max(1000),
  rpe: z.number().min(1).max(10).multipleOf(0.5).nullable(),
  completedAt: instantSchema.nullable(),
})

export type Workout = z.infer<typeof workoutSchema>
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>
export type SetKind = z.infer<typeof setKindSchema>
export type WorkoutSet = z.infer<typeof workoutSetSchema>
export type WeightUnit = z.infer<typeof weightUnitSchema>
