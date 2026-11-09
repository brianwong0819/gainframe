import { BUILT_IN_EXERCISES, type Equipment, type Exercise } from '@gainframe/shared'

export type ExerciseInfo = Pick<Exercise, 'nameZh' | 'nameEn' | 'equipment'>

const builtIns = new Map<string, ExerciseInfo>(
  BUILT_IN_EXERCISES.map((exercise) => [exercise.id, exercise]),
)

const unknown: ExerciseInfo = { nameZh: null, nameEn: null, equipment: 'other' }

// A built-in exercise, or one of the user's own. `custom` includes deleted
// exercises, so a workout keeps the names of exercises deleted since.
export function findExercise(id: string, custom: readonly Exercise[]): ExerciseInfo {
  return builtIns.get(id) ?? custom.find((exercise) => exercise.id === id) ?? unknown
}

// Weights read as plain numbers: 60, 62.5, 1.25.
export function formatKg(kg: number): string {
  return String(Math.round(kg * 100) / 100)
}

export function isBodyweight(equipment: Equipment): boolean {
  return equipment === 'bodyweight'
}
