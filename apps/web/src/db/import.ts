import {
  bodyMetricSchema,
  exerciseSchema,
  exerciseUnitSchema,
  foodSchema,
  mealItemSchema,
  mealSchema,
  planDaySchema,
  planItemSchema,
  planSchema,
  profileSchema,
  type SyncedTableName,
  workoutExerciseSchema,
  workoutSchema,
  workoutSetSchema,
} from '@gainframe/shared'
import { z } from 'zod'

import { EXPORT_FORMAT, EXPORT_FORMAT_VERSION } from './export'
import type { GainframeDb } from './schema'

// The synced tables of an export file (db/export.ts). Exercises come first: the
// outbox is pushed in this order, and the server accepts a row that refers to a
// custom exercise only once it holds that exercise. The file's device settings
// are not read: they belong to the device that wrote it.
const fileTablesSchema = z.object({
  exercises: z.array(exerciseSchema),
  plans: z.array(planSchema),
  planDays: z.array(planDaySchema),
  planItems: z.array(planItemSchema),
  workouts: z.array(workoutSchema),
  workoutExercises: z.array(workoutExerciseSchema),
  workoutSets: z.array(workoutSetSchema),
  meals: z.array(mealSchema),
  mealItems: z.array(mealItemSchema),
  profiles: z.array(profileSchema),
  bodyMetrics: z.array(bodyMetricSchema),
  foods: z.array(foodSchema),
  exerciseUnits: z.array(exerciseUnitSchema),
})

const exportFileSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  formatVersion: z.literal(EXPORT_FORMAT_VERSION),
  databaseVersion: z.int(),
  exportedAt: z.iso.datetime(),
  tables: fileTablesSchema,
})

export type ExportFile = z.infer<typeof exportFileSchema>

type FileRow = ExportFile['tables'][SyncedTableName][number]

const IMPORTED_TABLES = fileTablesSchema.keyof().options

const live = (row: { deletedAt: string | null }) => row.deletedAt === null

/**
 * What a file holds and what importing it would change. `changes` counts the
 * rows that are not on this device or are newer in the file; the others are
 * left as they are.
 */
export interface ImportPreview {
  file: ExportFile
  workouts: number
  plans: number
  exercises: number
  meals: number
  weighIns: number
  changes: number
}

// notExport: not JSON, or not a Gainframe export. newerApp: written by a newer
// database version than this app's, which this app may not read correctly.
// invalid: a Gainframe export with a row this app's schemas refuse.
export type ImportCheck =
  { status: 'ready'; preview: ImportPreview } | { status: 'notExport' | 'newerApp' | 'invalid' }

const headerSchema = z.object({ format: z.literal(EXPORT_FORMAT), databaseVersion: z.int() })

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Checks a whole file before anything is written, and counts what it would change. */
export async function checkImport(db: GainframeDb, text: string): Promise<ImportCheck> {
  const json = parseJson(text)
  const header = headerSchema.safeParse(json)
  if (!header.success) return { status: 'notExport' }
  if (header.data.databaseVersion > db.verno) return { status: 'newerApp' }
  const parsed = exportFileSchema.safeParse(json)
  if (!parsed.success) return { status: 'invalid' }
  const file = parsed.data
  const changes = await db.transaction('r', [...IMPORTED_TABLES], async () => {
    let count = 0
    for (const table of IMPORTED_TABLES) count += (await changedRows(db, table, file)).length
    return count
  })
  const { tables } = file
  return {
    status: 'ready',
    preview: {
      file,
      workouts: tables.workouts.filter(live).length,
      plans: tables.plans.filter(live).length,
      exercises: tables.exercises.filter(live).length,
      meals: tables.meals.filter(live).length,
      weighIns: tables.bodyMetrics.filter(live).length,
      changes,
    },
  }
}

// The file's rows of one table that this device lacks or holds an older
// version of. Last writer wins on `updatedAt`, as in a pull (ADR-0003).
async function changedRows(
  db: GainframeDb,
  table: SyncedTableName,
  file: ExportFile,
): Promise<FileRow[]> {
  const rows: FileRow[] = file.tables[table]
  const local = await db.table<FileRow, string>(table).bulkGet(rows.map((row) => row.id))
  return rows.filter((row, index) => {
    const current = local[index]
    return current === undefined || Date.parse(row.updatedAt) > Date.parse(current.updatedAt)
  })
}

/**
 * Writes the file's new and newer rows, each with an outbox entry, in one
 * transaction: a failure leaves the device as it was. A row keeps its ID and
 * `updatedAt`, so importing the same file again changes nothing, but loses its
 * `userId`: the file may come from another account or environment, and the
 * next push files the row under the signed-in account (M2-06). Returns the
 * number of rows written.
 */
export async function importData(db: GainframeDb, file: ExportFile): Promise<number> {
  return db.transaction('rw', [...IMPORTED_TABLES, 'outbox'], async () => {
    let count = 0
    for (const table of IMPORTED_TABLES) {
      const rows = await changedRows(db, table, file)
      await db.table<FileRow, string>(table).bulkPut(rows.map((row) => ({ ...row, userId: null })))
      await db.outbox.bulkAdd(rows.map((row) => ({ table, rowId: row.id })))
      count += rows.length
    }
    return count
  })
}
