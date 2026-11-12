import { z } from 'zod'

import { restSecondsSchema } from './exercise.ts'
import { syncedRowSchema } from './row.ts'

// A note kept with a plan item and copied into each workout slot started from it.
export const planNoteSchema = z.string().max(500)

// A training plan: a split of days done in rotation (for example push, pull,
// legs). A user may keep several; which one is active is a device setting, not a
// field here, so two devices can never both mark a plan active.
export const planSchema = syncedRowSchema.extend({
  name: z.string().trim().min(1).max(80),
})

// One day of a plan's rotation, ordered by `position`.
export const planDaySchema = syncedRowSchema.extend({
  planId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  position: z.int().min(0),
})

// One exercise slot of a plan day. It stores no weight: a workout prefills last
// time's weight. A workout prefills `repsMin`; the user logs the reps done.
// `restS` null means the exercise's default rest. `note` is the plan's own note
// for the exercise (seat height, grip, a cue), shown in every workout of the
// day; a workout's note for that exercise is separate. Items with the same
// `supersetGroup` are performed alternately; null means a standalone exercise.
// `planId` copies the day's plan when the item is created and never changes, so
// deleting a plan reaches its items directly.
export const planItemSchema = syncedRowSchema
  .extend({
    planId: z.uuid(),
    planDayId: z.uuid(),
    exerciseId: z.uuid(),
    position: z.int().min(0),
    supersetGroup: z.int().min(0).nullable(),
    targetSets: z.int().min(1).max(20),
    repsMin: z.int().min(1).max(100),
    repsMax: z.int().min(1).max(100),
    restS: restSecondsSchema.nullable(),
    note: planNoteSchema.nullable(),
  })
  .refine((item) => item.repsMin <= item.repsMax, {
    message: 'The rep range cannot end below its start',
    path: ['repsMax'],
  })

export type Plan = z.infer<typeof planSchema>
export type PlanDay = z.infer<typeof planDaySchema>
export type PlanItem = z.infer<typeof planItemSchema>
