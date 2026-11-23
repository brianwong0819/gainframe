import { bodyMetricSchema, profileSchema } from '@gainframe/shared'

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

const parseWith = (text: string, check: (value: number) => boolean): number | null => {
  if (text.trim() === '') return null
  const value = Number(text.trim().replace(',', '.'))
  return check(value) ? value : null
}

export const parseBirthYear = (text: string) =>
  parseWith(text, (value) => profileSchema.shape.birthYear.safeParse(value).success)

export const parseHeightCm = (text: string) =>
  parseWith(text, (value) => profileSchema.shape.heightCm.safeParse(value).success)

export const parseWeightKg = (text: string) =>
  parseWith(text, (value) => bodyMetricSchema.shape.weightKg.safeParse(value).success)
