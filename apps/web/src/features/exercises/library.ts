import type { BuiltInExercise, Exercise, MuscleGroup } from '@gainframe/shared'
import { BUILT_IN_EXERCISES, searchExercises } from '@gainframe/shared'

import type { NewRow } from '@/db/repositories'
import type { Locale } from '@/i18n/locale'

// One row of the library: a built-in exercise or one of the user's own.
export type LibraryEntry = (BuiltInExercise & { custom: false }) | (Exercise & { custom: true })

const builtIns: readonly LibraryEntry[] = BUILT_IN_EXERCISES.map((exercise) => ({
  ...exercise,
  custom: false,
}))

// The user's exercises, newest first, then the built-in ones in catalog order,
// narrowed to one muscle group (null for all) and the search query.
export function libraryEntries(
  custom: readonly Exercise[],
  muscle: MuscleGroup | null,
  query: string,
): LibraryEntry[] {
  const own = [...custom]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((exercise): LibraryEntry => ({ ...exercise, custom: true }))
  const all = [...own, ...builtIns].filter((entry) => muscle === null || entry.muscle === muscle)
  return searchExercises(all, query)
}

// The name in the app's language, else the other one (a custom exercise may
// have only one).
export function exerciseName(
  exercise: Pick<Exercise, 'nameZh' | 'nameEn'>,
  locale: Locale,
): string {
  const [first, second] =
    locale === 'zh' ? [exercise.nameZh, exercise.nameEn] : [exercise.nameEn, exercise.nameZh]
  return first ?? second ?? ''
}

// Rest as m:ss, e.g. 90 → "1:30".
export function formatRest(seconds: number): string {
  return `${Math.floor(seconds / 60).toString()}:${(seconds % 60).toString().padStart(2, '0')}`
}

export const REST_STEP_S = 15
export const REST_MAX_S = 600

export interface ExerciseDraft {
  nameZh: string
  nameEn: string
  muscle: MuscleGroup
  equipment: Exercise['equipment']
  defaultRestS: number
}

// Form values to repository input: names are trimmed, and a blank name is null.
export function draftToExercise(draft: ExerciseDraft): NewRow<Exercise> {
  const name = (value: string) => (value.trim() === '' ? null : value.trim())
  return {
    nameZh: name(draft.nameZh),
    nameEn: name(draft.nameEn),
    muscle: draft.muscle,
    equipment: draft.equipment,
    defaultRestS: draft.defaultRestS,
  }
}
