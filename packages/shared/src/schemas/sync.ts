import { z } from 'zod'

import { syncConfig } from '../config.ts'
import { bodyMetricSchema } from './body-metric.ts'
import { exerciseSchema } from './exercise.ts'
import { exerciseUnitSchema } from './exercise-unit.ts'
import { foodSchema, mealItemSchema, mealSchema } from './food.ts'
import { planDaySchema, planItemSchema, planSchema } from './plan.ts'
import { profileSchema } from './profile.ts'
import { workoutExerciseSchema, workoutSchema, workoutSetSchema } from './workout.ts'

// The sync protocol (ADR-0003). The client sends its version in this header on
// every push and pull; the server answers one it no longer supports with
// `update_required`, so an old app asks to be updated instead of syncing.
// Version 2 (M3-01) adds the meal tables, version 3 (M3-02) the profile, and
// version 4 (M4-01) the profile's body fields and the body metrics, which an
// older app cannot read in a pull and would clear in a push. Version 5 (M3-11)
// adds the meal item source `table`, which an older app fails to parse.
// Version 6 (M3-12) adds the user's foods. Version 7 adds the plan's
// `activatedAt`, which an older app would clear in a push. Version 8 adds the
// per-exercise weight units, which an older app fails to parse in a pull.
export const SYNC_VERSION = 8
export const SYNC_VERSION_HEADER = 'x-gainframe-sync-version'

// Synced tables by their Dexie names; the server's Drizzle tables use the same keys.
export const syncedRowSchemas = {
  exercises: exerciseSchema,
  plans: planSchema,
  planDays: planDaySchema,
  planItems: planItemSchema,
  workouts: workoutSchema,
  workoutExercises: workoutExerciseSchema,
  workoutSets: workoutSetSchema,
  meals: mealSchema,
  mealItems: mealItemSchema,
  profiles: profileSchema,
  bodyMetrics: bodyMetricSchema,
  foods: foodSchema,
  exerciseUnits: exerciseUnitSchema,
}

export const syncedTableNameSchema = z.object(syncedRowSchemas).keyof()

export type SyncedTableName = z.infer<typeof syncedTableNameSchema>

// A row as it travels in a push or pull. A push checks `row` against the table's
// schema one row at a time, so one bad row is rejected without failing the batch.
// The server sets `userId` from the verified token; a value the client sends is
// replaced.
const syncedRowEnvelopeSchema = z.object({
  table: syncedTableNameSchema,
  row: z.record(z.string(), z.unknown()),
})

export const pushRequestSchema = z.object({
  rows: z.array(syncedRowEnvelopeSchema).min(1).max(syncConfig.pushBatchMax),
})

// invalid: the row fails its schema. clock_skew: `updatedAt` is further ahead
// of the server clock than `syncConfig.clockSkewMs`. not_owned: the ID belongs
// to another user. unknown_exercise: `exerciseId` is neither built in nor one
// of the user's exercises. `issues` holds Zod issue paths, never values.
export const pushRejectionSchema = z.enum([
  'invalid',
  'clock_skew',
  'not_owned',
  'unknown_exercise',
])

// One result per pushed row, in request order. applied: stored. ignored: the
// stored row is as new or newer (last writer wins; a replay is a no-op).
export const pushResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('applied') }),
  z.object({ status: z.literal('ignored') }),
  z.object({
    status: z.literal('rejected'),
    reason: pushRejectionSchema,
    issues: z.array(z.string()),
  }),
])

export const pushResponseSchema = z.object({ results: z.array(pushResultSchema) })

// Rows changed after `cursor`, in the order the server applied them. The client
// stores `cursor` once the page is applied and asks again while `more` is true.
export const pullResponseSchema = z.object({
  rows: z.array(syncedRowEnvelopeSchema),
  cursor: z.int().min(0),
  more: z.boolean(),
})

export type PushRequest = z.infer<typeof pushRequestSchema>
export type PushRejection = z.infer<typeof pushRejectionSchema>
export type PushResult = z.infer<typeof pushResultSchema>
export type PushResponse = z.infer<typeof pushResponseSchema>
export type PullResponse = z.infer<typeof pullResponseSchema>
