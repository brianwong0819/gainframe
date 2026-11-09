import { workoutSetSchema } from '@gainframe/shared'

// Typed weight or reps from the set panel. A comma is read as a decimal point
// (keypads in many locales show one). Null for anything the set schema would
// reject, so a stray keystroke never reaches the database.
export function parseWeightKg(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(value)) return null
  const rounded = Math.round(value * 100) / 100
  return workoutSetSchema.shape.weightKg.safeParse(rounded).success ? rounded : null
}

export function parseReps(text: string): number | null {
  const value = Number(text.trim())
  if (text.trim() === '') return null
  return workoutSetSchema.shape.reps.safeParse(value).success ? value : null
}
