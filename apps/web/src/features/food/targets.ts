import { profileSchema } from '@gainframe/shared'

// A typed daily target. Null for anything the profile schema would reject, so
// a stray keystroke never reaches the database. Energy is a whole number.
export function parseProteinTarget(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  if (text.trim() === '') return null
  return profileSchema.shape.proteinValue.safeParse(value).success ? value : null
}

export function parseKcalTarget(text: string): number | null {
  const value = Number(text.trim())
  if (text.trim() === '') return null
  return profileSchema.shape.kcalTarget.safeParse(value).success ? value : null
}
