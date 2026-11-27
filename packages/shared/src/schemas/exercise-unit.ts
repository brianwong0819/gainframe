import { z } from 'zod'

import { syncedRowSchema } from './row.ts'
import { weightUnitSchema } from './workout.ts'

// The unit one exercise is shown and typed in, kept per exercise (built-in or
// the user's own) so it follows the account to a new device. Weights are stored
// in kg whatever the unit. One row per exercise in meaning: two devices that
// set a unit before their first sync can each create a row, and every device
// reads the most recently updated one (`unitsByExercise` in the web app).
export const exerciseUnitSchema = syncedRowSchema.extend({
  exerciseId: z.uuidv7(),
  weightUnit: weightUnitSchema,
})

export type ExerciseUnit = z.infer<typeof exerciseUnitSchema>
