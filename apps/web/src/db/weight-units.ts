import { type WeightUnit, weightUnitSchema } from '@gainframe/shared'

import type { GainframeDb } from './schema'

const PREFIX = 'weightUnit:'

// The unit each exercise is shown and typed in, as device settings: a machine
// labelled in pounds stays in pounds next time. Exercises without a setting use
// kg, so only pounds is stored.
export function createWeightUnitStore(db: GainframeDb) {
  return {
    // Exercise ID to unit, for every exercise not in kg.
    async all(): Promise<Map<string, WeightUnit>> {
      const settings = await db.settings.where('key').startsWith(PREFIX).toArray()
      const units = new Map<string, WeightUnit>()
      for (const { key, value } of settings) {
        const unit = weightUnitSchema.safeParse(value)
        if (unit.success) units.set(key.slice(PREFIX.length), unit.data)
      }
      return units
    },

    async set(exerciseId: string, unit: WeightUnit): Promise<void> {
      const key: `weightUnit:${string}` = `${PREFIX}${exerciseId}`
      if (unit === 'kg') await db.settings.delete(key)
      else await db.settings.put({ key, value: unit })
    },
  }
}
