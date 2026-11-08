import { z } from 'zod'

import { instantSchema, localDateSchema, syncedRowSchema } from './row.ts'

export const workoutSchema = syncedRowSchema
  .extend({
    startedAt: instantSchema,
    endedAt: instantSchema.nullable(),
    templateId: z.uuid().nullable(),
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
export const setKindSchema = z.enum(['warmup', 'working', 'drop', 'failure'])

// One set. `completedAt` is null while the set is planned but not yet done.
// Bodyweight sets have `weightKg` 0.
export const workoutSetSchema = syncedRowSchema.extend({
  workoutId: z.uuid(),
  exerciseId: z.uuid(),
  supersetGroup: z.int().min(0).nullable(),
  position: z.int().min(0),
  kind: setKindSchema,
  weightKg: z.number().min(0).max(1000),
  reps: z.int().min(0).max(1000),
  rpe: z.number().min(1).max(10).multipleOf(0.5).nullable(),
  completedAt: instantSchema.nullable(),
})

export type Workout = z.infer<typeof workoutSchema>
export type SetKind = z.infer<typeof setKindSchema>
export type WorkoutSet = z.infer<typeof workoutSetSchema>
