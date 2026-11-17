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

const builtInsById = new Map(builtIns.map((entry) => [entry.id, entry]))

// One exercise as a library entry, built-in or the user's own (`custom` may
// include deleted ones); undefined for an ID that matches neither.
export function findLibraryEntry(
  id: string,
  custom: readonly Exercise[],
): LibraryEntry | undefined {
  const builtIn = builtInsById.get(id)
  if (builtIn) return builtIn
  const own = custom.find((exercise) => exercise.id === id)
  return own && { ...own, custom: true }
}

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

// The muscles picked in the form; a new exercise starts with no primary muscle.
export interface MuscleSelection {
  muscle: MuscleGroup | null
  secondaryMuscles: MuscleGroup[]
}

export interface ExerciseDraft extends MuscleSelection {
  nameZh: string
  nameEn: string
  equipment: Exercise['equipment']
  defaultRestS: number
}

// One tap on a muscle in the form. The first muscle tapped becomes the primary
// one and later ones are secondary; tapping a picked muscle unpicks it, and the
// first secondary muscle takes over when the primary one is unpicked. Full body
// stands alone: picking it, or anything while it is picked, starts over.
export function pickMuscle(selection: MuscleSelection, tapped: MuscleGroup): MuscleSelection {
  const { muscle, secondaryMuscles } = selection
  if (tapped === muscle) {
    const [next = null, ...rest] = secondaryMuscles
    return { muscle: next, secondaryMuscles: rest }
  }
  if (secondaryMuscles.includes(tapped)) {
    return { muscle, secondaryMuscles: secondaryMuscles.filter((m) => m !== tapped) }
  }
  if (muscle === null) return { muscle: tapped, secondaryMuscles }
  if (muscle === 'full_body' || tapped === 'full_body') {
    return { muscle: tapped, secondaryMuscles: [] }
  }
  return { muscle, secondaryMuscles: [...secondaryMuscles, tapped] }
}

// Form values to repository input: names are trimmed, and a blank name is null.
const han = /\p{Script=Han}/u

// The form's starting values for a new exercise named after a search: a name
// with Chinese characters fills the Chinese name, anything else the English
// one.
export function newDraft(name: string, muscle: MuscleGroup | null): ExerciseDraft {
  const trimmed = name.trim()
  return {
    nameZh: han.test(trimmed) ? trimmed : '',
    nameEn: han.test(trimmed) ? '' : trimmed,
    muscle,
    secondaryMuscles: [],
    equipment: 'barbell',
    defaultRestS: 90,
  }
}

export function draftToExercise(draft: ExerciseDraft & { muscle: MuscleGroup }): NewRow<Exercise> {
  const name = (value: string) => (value.trim() === '' ? null : value.trim())
  return {
    nameZh: name(draft.nameZh),
    nameEn: name(draft.nameEn),
    muscle: draft.muscle,
    secondaryMuscles: draft.secondaryMuscles,
    equipment: draft.equipment,
    defaultRestS: draft.defaultRestS,
  }
}
