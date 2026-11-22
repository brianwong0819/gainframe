import { z } from 'zod'

import { syncedRowSchema } from './row.ts'

// How the daily protein target is set. fixed: `proteinValue` is grams a day.
// M4-01 adds grams per kg of body weight.
export const proteinModeSchema = z.enum(['fixed'])

// The user's goals. One per user in meaning: two devices that set targets
// before their first sync can each create a row, and every device reads the
// most recently updated one (`currentProfile` in the web app), so the latest
// change wins as it does for any row. M4-01 adds the body and phase fields.
export const profileSchema = syncedRowSchema.extend({
  proteinMode: proteinModeSchema,
  proteinValue: z.number().positive().max(1000),
  kcalTarget: z.int().positive().max(20000),
})

export type ProteinMode = z.infer<typeof proteinModeSchema>
export type Profile = z.infer<typeof profileSchema>
