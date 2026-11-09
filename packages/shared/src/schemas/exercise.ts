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

// Compound exercises move several joints and get longer default rests.
export const mechanicSchema = z.enum(['compound', 'isolation'])

const exerciseNameSchema = z.string().trim().min(1).max(80)
const restSecondsSchema = z.int().min(0).max(3600)

// A custom exercise. Built-in exercises are a constant with fixed IDs, not rows
// (ADR-0003). A custom exercise needs a name in at least one language.
export const exerciseSchema = syncedRowSchema
  .extend({
    nameZh: exerciseNameSchema.nullable(),
    nameEn: exerciseNameSchema.nullable(),
    muscle: muscleGroupSchema,
    equipment: equipmentSchema,
    defaultRestS: restSecondsSchema,
  })
  .refine((exercise) => exercise.nameZh !== null || exercise.nameEn !== null, {
    message: 'An exercise needs a Chinese or an English name',
    path: ['nameEn'],
  })

// A built-in exercise: shipped as a constant with a fixed ID, never stored or synced
// (ADR-0003). `aliases` are extra search terms such as abbreviations ("RDL").
export const builtInExerciseSchema = z
  .object({
    id: z.uuidv7(),
    nameZh: exerciseNameSchema,
    nameEn: exerciseNameSchema,
    aliases: z.array(exerciseNameSchema),
    muscle: muscleGroupSchema,
    secondaryMuscles: z.array(muscleGroupSchema),
    equipment: equipmentSchema,
    mechanic: mechanicSchema,
    defaultRestS: restSecondsSchema,
  })
  .refine((exercise) => !exercise.secondaryMuscles.includes(exercise.muscle), {
    message: 'The primary muscle is not also a secondary muscle',
    path: ['secondaryMuscles'],
  })

// Form cues for a built-in exercise: two or three short lines, the same ones in
// each language.
const cueListSchema = z.array(z.string().trim().min(1).max(80)).min(2).max(3)
export const exerciseCuesSchema = z
  .object({ zh: cueListSchema, en: cueListSchema })
  .refine((cues) => cues.zh.length === cues.en.length, {
    message: 'Both languages have the same number of cues',
    path: ['en'],
  })

export type MuscleGroup = z.infer<typeof muscleGroupSchema>
export type Equipment = z.infer<typeof equipmentSchema>
export type Exercise = z.infer<typeof exerciseSchema>
export type Mechanic = z.infer<typeof mechanicSchema>
export type BuiltInExercise = z.infer<typeof builtInExerciseSchema>
export type ExerciseCues = z.infer<typeof exerciseCuesSchema>
