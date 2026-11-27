import { type ExerciseUnit, type WeightUnit } from '@gainframe/shared'

import type { Repositories } from './repositories'
import type { GainframeDb } from './schema'

// The unit each exercise is shown and typed in, as synced rows so it follows
// the account to a new device (L-051): a machine labelled in pounds stays in
// pounds. Exercises without a row use kg.
export function createWeightUnitStore(db: GainframeDb, repositories: Repositories) {
  return {
    // Exercise ID to unit, for every exercise not in kg.
    async all(): Promise<Map<string, WeightUnit>> {
      const units = new Map<string, WeightUnit>()
      for (const [exerciseId, row] of await latestRows(db)) {
        if (row.weightUnit !== 'kg') units.set(exerciseId, row.weightUnit)
      }
      return units
    },

    // The row for the exercise is kept when the unit goes back to kg, so the
    // change reaches other devices as an update; the latest change wins.
    async set(exerciseId: string, unit: WeightUnit): Promise<void> {
      const current = (await latestRows(db)).get(exerciseId)
      if (current === undefined) {
        if (unit !== 'kg') await repositories.exerciseUnits.create({ exerciseId, weightUnit: unit })
      } else if (current.weightUnit !== unit) {
        await repositories.exerciseUnits.update(current.id, { weightUnit: unit })
      }
    },
  }
}

// Two devices that set a unit before their first sync can each create a row for
// the same exercise; the most recently updated one counts.
async function latestRows(db: GainframeDb): Promise<Map<string, ExerciseUnit>> {
  const rows = await db.exerciseUnits.filter((row) => row.deletedAt === null).toArray()
  const latest = new Map<string, ExerciseUnit>()
  for (const row of rows) {
    const other = latest.get(row.exerciseId)
    if (other === undefined || row.updatedAt > other.updatedAt) latest.set(row.exerciseId, row)
  }
  return latest
}
