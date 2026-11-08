import { z } from 'zod'

import { syncedRowSchema } from './row.ts'

export const muscleGroupSchema = z.enum([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'full_body',
])

export const equipmentSchema = z.enum([
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'kettlebell',
  'band',
  'bodyweight',
  'other',
])

const exerciseNameSchema = z.string().trim().min(1).max(80)

// A custom exercise. Built-in exercises are a constant with fixed IDs, not rows
// (ADR-0003). A custom exercise needs a name in at least one language.
export const exerciseSchema = syncedRowSchema
  .extend({
    nameZh: exerciseNameSchema.nullable(),
    nameEn: exerciseNameSchema.nullable(),
    muscle: muscleGroupSchema,
    equipment: equipmentSchema,
    defaultRestS: z.int().min(0).max(3600),
  })
  .refine((exercise) => exercise.nameZh !== null || exercise.nameEn !== null, {
    message: 'An exercise needs a Chinese or an English name',
    path: ['nameEn'],
  })

export type MuscleGroup = z.infer<typeof muscleGroupSchema>
export type Equipment = z.infer<typeof equipmentSchema>
export type Exercise = z.infer<typeof exerciseSchema>
