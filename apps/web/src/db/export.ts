import { toLocalDate } from '@gainframe/shared'

import type { GainframeDb } from './schema'

// Every table a backup needs: the synced rows, soft-deleted ones included so
// the file is a faithful copy, and the device settings (current plan, weight
// units) but not the signed-in session, whose tokens must not leave the app
// in a file. The outbox and the sync settings are sync bookkeeping and the error log has its own copy
// button, so both are left out.
const EXPORTED_TABLES = [
  'exercises',
  'plans',
  'planDays',
  'planItems',
  'workouts',
  'workoutExercises',
  'workoutSets',
  'meals',
  'mealItems',
  'profiles',
  'bodyMetrics',
  'settings',
] as const

const NOT_EXPORTED = new Set(['authSession', 'syncCursor', 'lastSyncAt'])

export const EXPORT_FORMAT = 'gainframe-export'
export const EXPORT_FORMAT_VERSION = 1

/** All of the user's data on this device, read in one transaction so the tables agree. */
export async function exportData(db: GainframeDb, release: string, exportedAt: string) {
  return db.transaction('r', [...EXPORTED_TABLES], async () => ({
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    databaseVersion: db.verno,
    release,
    exportedAt,
    tables: {
      exercises: await db.exercises.toArray(),
      plans: await db.plans.toArray(),
      planDays: await db.planDays.toArray(),
      planItems: await db.planItems.toArray(),
      workouts: await db.workouts.toArray(),
      workoutExercises: await db.workoutExercises.toArray(),
      workoutSets: await db.workoutSets.toArray(),
      meals: await db.meals.toArray(),
      mealItems: await db.mealItems.toArray(),
      profiles: await db.profiles.toArray(),
      bodyMetrics: await db.bodyMetrics.toArray(),
      settings: await db.settings.filter((setting) => !NOT_EXPORTED.has(setting.key)).toArray(),
    },
  }))
}

export type DataExport = Awaited<ReturnType<typeof exportData>>

/** "gainframe-2026-11-16.json", dated on the device's calendar. */
export function exportFileName(exportedAt: string, timeZone: string): string {
  return `gainframe-${toLocalDate(exportedAt, timeZone)}.json`
}
