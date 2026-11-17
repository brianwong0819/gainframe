import { BUILT_IN_EXERCISES, type Exercise, restSeconds } from '@gainframe/shared'
import type { Table } from 'dexie'

const builtInRest = new Map(BUILT_IN_EXERCISES.map(({ id, defaultRestS }) => [id, defaultRestS]))

// The rest of a plan item or workout slot in seconds: its own, else its
// exercise's default (built-in or the user's own, deleted ones included), else
// the fallback. Reads the user's exercises once, so a transaction can resolve
// many rows.
export async function restResolver(
  exercises: Table<Exercise, string>,
): Promise<(row: { exerciseId: string; restS: number | null }) => number> {
  const custom = new Map(
    (await exercises.toArray()).map(({ id, defaultRestS }) => [id, defaultRestS]),
  )
  return ({ exerciseId, restS }) =>
    restSeconds(restS, builtInRest.get(exerciseId) ?? custom.get(exerciseId) ?? null)
}
