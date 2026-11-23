import { z } from 'zod'

import { instantSchema, localDateSchema, syncedRowSchema } from './row.ts'

// Where a measurement came from: typed by the user, or (version 2) read from a
// body composition scan or Apple Health.
export const bodyMetricSourceSchema = z.enum(['manual', 'scan', 'health'])

// One measurement (ROADMAP M4-02): the weight always, the composition figures
// only from a scan. The first row is written by the target calculator (M4-01).
export const bodyMetricSchema = syncedRowSchema.extend({
  measuredAt: instantSchema,
  localDate: localDateSchema,
  weightKg: z.number().min(20).max(400),
  bodyFatPct: z.number().min(2).max(70).nullable(),
  skeletalMuscleKg: z.number().positive().max(200).nullable(),
  fatMassKg: z.number().min(0).max(300).nullable(),
  source: bodyMetricSourceSchema,
})

export type BodyMetric = z.infer<typeof bodyMetricSchema>
