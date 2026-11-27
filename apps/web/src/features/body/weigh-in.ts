import { bodyMetricSchema } from '@gainframe/shared'

// A typed weigh-in figure, or null for anything the schema would reject, so a
// stray keystroke never reaches the database. A comma is read as the decimal
// point, as Malaysian and Chinese keypads may offer it.
function parseWith(text: string, field: 'weightKg' | 'bodyFatPct' | 'skeletalMuscleKg') {
  if (text.trim() === '') return null
  const value = Number(text.trim().replace(',', '.'))
  return bodyMetricSchema.shape[field].safeParse(value).success ? value : null
}

export const parseBodyWeight = (text: string) => parseWith(text, 'weightKg')
export const parseBodyFat = (text: string) => parseWith(text, 'bodyFatPct')
export const parseMuscleMass = (text: string) => parseWith(text, 'skeletalMuscleKg')

// A stepper value after one tap, kept on its 0.1 grid so float drift never
// shows ("62.400000001").
export const stepTenth = (value: number, step: number, direction: -1 | 1) =>
  Math.round((value + direction * step) * 10) / 10
