import { domainConfig } from '../config.ts'

// The rest after a set: the plan item's rest copied to the slot, else the
// exercise's default, else the fallback for an exercise that cannot be found.
// 0 means no rest.
export function restSeconds(slotRestS: number | null, exerciseRestS: number | null): number {
  return slotRestS ?? exerciseRestS ?? domainConfig.rest.fallbackS
}

export interface RestTimes {
  restStartedAt: string
  restEndsAt: string
}

export type RestState =
  { phase: 'running'; remainingMs: number; totalMs: number } | { phase: 'over'; overdueMs: number }

// Where a rest stands at `nowMs`, always computed from its stored end, so a
// page that was frozen or relaunched shows the right time at once.
export function restState(rest: RestTimes, nowMs: number): RestState {
  const endMs = Date.parse(rest.restEndsAt)
  if (nowMs >= endMs) return { phase: 'over', overdueMs: nowMs - endMs }
  return {
    phase: 'running',
    remainingMs: endMs - nowMs,
    totalMs: endMs - Date.parse(rest.restStartedAt),
  }
}

// The end after moving it by `deltaS` seconds, never before `nowMs`: taking
// more time off than is left ends the rest now.
export function adjustRestEnd(restEndsAt: string, deltaS: number, nowMs: number): string {
  return new Date(Math.max(nowMs, Date.parse(restEndsAt) + deltaS * 1000)).toISOString()
}
