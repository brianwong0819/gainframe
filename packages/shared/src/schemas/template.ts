import { z } from 'zod'

import { syncedRowSchema } from './row.ts'

export const templateSchema = syncedRowSchema.extend({
  name: z.string().trim().min(1).max(80),
})

// One exercise slot in a template. Items with the same `supersetGroup` are
// performed alternately; null means a standalone exercise.
export const templateItemSchema = syncedRowSchema.extend({
  templateId: z.uuid(),
  exerciseId: z.uuid(),
  position: z.int().min(0),
  supersetGroup: z.int().min(0).nullable(),
  targetSets: z.int().min(1).max(20),
  targetReps: z.int().min(1).max(100).nullable(),
})

export type Template = z.infer<typeof templateSchema>
export type TemplateItem = z.infer<typeof templateItemSchema>
