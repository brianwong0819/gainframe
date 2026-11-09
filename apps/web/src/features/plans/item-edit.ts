import { BUILT_IN_EXERCISES, type Exercise, type Mechanic, type PlanItem } from '@gainframe/shared'

type RepRange = Pick<PlanItem, 'repsMin' | 'repsMax'>

// "8–12", or "8" when the range is one number.
export function formatRepRange({ repsMin, repsMax }: RepRange): string {
  return repsMin === repsMax ? String(repsMin) : `${String(repsMin)}–${String(repsMax)}`
}

// A new low end of the range; the high end moves up with it if needed, so the
// range stays valid.
export function withRepsMin(range: RepRange, repsMin: number): RepRange {
  return { repsMin, repsMax: Math.max(range.repsMax, repsMin) }
}

// A new high end of the range; the low end moves down with it if needed.
export function withRepsMax(range: RepRange, repsMax: number): RepRange {
  return { repsMin: Math.min(range.repsMin, repsMax), repsMax }
}

export interface RestInfo {
  defaultRestS: number
  // Null for the user's own exercises, which have none: no rest is suggested.
  mechanic: Mechanic | null
}

const builtIns = new Map(BUILT_IN_EXERCISES.map((exercise) => [exercise.id, exercise]))

// What a plan item's rest depends on. `custom` includes deleted exercises.
export function restInfo(exerciseId: string, custom: readonly Exercise[]): RestInfo {
  const builtIn = builtIns.get(exerciseId)
  if (builtIn) return { defaultRestS: builtIn.defaultRestS, mechanic: builtIn.mechanic }
  const own = custom.find((exercise) => exercise.id === exerciseId)
  return { defaultRestS: own?.defaultRestS ?? 0, mechanic: null }
}
