import type { SyncedTableName } from '@gainframe/shared'

import type { GainframeDb } from './schema'

export interface TableSummary {
  table: SyncedTableName
  live: number
  deleted: number
}

export interface DatabaseSummary {
  tables: TableSummary[]
  outbox: number
  latestWorkoutId: string | null
}

// Row counts for the dev database page; Diagnostics (M1-11) will show the same.
export async function summarize(db: GainframeDb): Promise<DatabaseSummary> {
  const tables = await Promise.all(
    (
      [
        ['exercises', db.exercises],
        ['plans', db.plans],
        ['planDays', db.planDays],
        ['planItems', db.planItems],
        ['workouts', db.workouts],
        ['workoutExercises', db.workoutExercises],
        ['workoutSets', db.workoutSets],
        ['meals', db.meals],
        ['mealItems', db.mealItems],
        ['profiles', db.profiles],
      ] as const
    ).map(async ([table, rows]) => {
      const total = await rows.count()
      const deleted = await rows.filter((row) => row.deletedAt !== null).count()
      return { table, live: total - deleted, deleted }
    }),
  )
  const latest = await db.workouts
    .orderBy('startedAt')
    .reverse()
    .filter((workout) => workout.deletedAt === null)
    .first()
  return { tables, outbox: await db.outbox.count(), latestWorkoutId: latest?.id ?? null }
}
