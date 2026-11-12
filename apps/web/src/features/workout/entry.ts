import { toKg, type WeightUnit, workoutSetSchema } from '@gainframe/shared'

// Typed weight or reps from the set panel. A comma is read as a decimal point
// (keypads in many locales show one). The weight is typed in `unit` and returned
// in kg. Null for anything the set schema would reject, so a stray keystroke
// never reaches the database.
export function parseWeight(text: string, unit: WeightUnit): number | null {
  const value = Number(text.trim().replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(value)) return null
  const weightKg = toKg(value, unit)
  return workoutSetSchema.shape.weightKg.safeParse(weightKg).success ? weightKg : null
}

export function parseReps(text: string): number | null {
  const value = Number(text.trim())
  if (text.trim() === '') return null
  return workoutSetSchema.shape.reps.safeParse(value).success ? value : null
}
