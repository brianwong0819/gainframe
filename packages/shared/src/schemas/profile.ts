import { z } from 'zod'

import { syncedRowSchema } from './row.ts'

// How the daily protein target is set. fixed: `proteinValue` is grams a day.
// M4-01 adds grams per kg of body weight.
export const proteinModeSchema = z.enum(['fixed'])

// For the energy estimate only (Mifflin-St Jeor has a term for each).
export const sexSchema = z.enum(['male', 'female'])

// Physical activity level, training included; config holds each one's factor.
export const activityLevelSchema = z.enum(['sedentary', 'light', 'moderate', 'high', 'veryHigh'])

// What the targets aim at: a surplus to gain, energy balance, or a deficit.
export const phaseSchema = z.enum(['bulk', 'maintain', 'cut'])

// The user's goals. One per user in meaning: two devices that set targets
// before their first sync can each create a row, and every device reads the
// most recently updated one (`currentProfile` in the web app), so the latest
// change wins as it does for any row. The body fields (M4-01, moved forward on
// 2026-11-23) are optional and used only for the estimate; null until the user
// fills in the calculator.
export const profileSchema = syncedRowSchema.extend({
  proteinMode: proteinModeSchema,
  proteinValue: z.number().positive().max(1000),
  kcalTarget: z.int().positive().max(20000),
  sex: sexSchema.nullable(),
  birthYear: z.int().min(1900).max(2100).nullable(),
  heightCm: z.number().min(100).max(250).nullable(),
  activityLevel: activityLevelSchema.nullable(),
  phase: phaseSchema.nullable(),
})

export type ProteinMode = z.infer<typeof proteinModeSchema>
export type Profile = z.infer<typeof profileSchema>
export type Sex = z.infer<typeof sexSchema>
export type ActivityLevel = z.infer<typeof activityLevelSchema>
export type Phase = z.infer<typeof phaseSchema>
