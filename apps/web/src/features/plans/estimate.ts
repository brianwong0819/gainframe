import { estimateDurationS, type Exercise, type PlanItem, restSeconds } from '@gainframe/shared'

import { findLibraryEntry } from '../exercises/library'

// A planned day is estimated to the nearest five minutes.
const ESTIMATE_STEP_S = 5 * 60

type EstimatedItem = Pick<PlanItem, 'exerciseId' | 'restS' | 'targetSets'>

// The rest a plan item gets in a workout: its own, else its exercise's default.
export function itemRestS(
  item: Pick<EstimatedItem, 'exerciseId' | 'restS'>,
  custom: readonly Exercise[],
): number {
  return restSeconds(item.restS, findLibraryEntry(item.exerciseId, custom)?.defaultRestS ?? null)
}

// A rough length for a planned day in seconds, to the nearest five minutes and
// at least five; 0 for a day without exercises.
export function estimateDayS(items: readonly EstimatedItem[], custom: readonly Exercise[]): number {
  const seconds = estimateDurationS(
    items.map((item) => ({ sets: item.targetSets, restS: itemRestS(item, custom) })),
  )
  if (seconds === 0) return 0
  return Math.max(1, Math.round(seconds / ESTIMATE_STEP_S)) * ESTIMATE_STEP_S
}
