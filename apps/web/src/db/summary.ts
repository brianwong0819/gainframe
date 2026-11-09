import type { GainframeDb, SyncedTableName } from './schema'

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
        ['templates', db.templates],
        ['templateItems', db.templateItems],
        ['workouts', db.workouts],
        ['workoutExercises', db.workoutExercises],
        ['workoutSets', db.workoutSets],
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
