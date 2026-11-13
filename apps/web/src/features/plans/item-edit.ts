import type { PlanItem } from '@gainframe/shared'

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
