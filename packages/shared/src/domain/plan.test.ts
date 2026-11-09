import { describe, expect, it } from 'vitest'

import type { PlanDay } from '../schemas/plan.ts'
import { localDateSchema } from '../schemas/row.ts'
import type { Workout } from '../schemas/workout.ts'
import { nextPlanDay, suggestRestS } from './plan.ts'

const PLAN = '01960000-0000-7000-8000-0000000000f1'
const DELETED = '2026-11-03T09:00:00.000Z'

const row = {
  userId: null,
  createdAt: '2026-11-02T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
  deletedAt: null,
}

function day(n: number, name: string, position: number, fields: Partial<PlanDay> = {}): PlanDay {
  return {
    ...row,
    id: `01960000-0000-7000-8000-0000000000d${String(n)}`,
    planId: PLAN,
    name,
    position,
    ...fields,
  }
}

const push = day(1, 'Push', 0)
const pull = day(2, 'Pull', 1)
const legs = day(3, 'Legs', 2)

let nextId = 0

function workout(
  planDay: PlanDay | null,
  startedAt: string,
  fields: Partial<Workout> = {},
): Workout {
  nextId += 1
  return {
    ...row,
    id: `01960000-0000-7000-8000-${String(nextId).padStart(12, '0')}`,
    startedAt,
    endedAt: new Date(Date.parse(startedAt) + 3_600_000).toISOString(),
    planDayId: planDay?.id ?? null,
    localDate: localDateSchema.parse('2026-11-02'),
    note: null,
    ...fields,
  }
}

describe('nextPlanDay', () => {
  it('starts a plan with no finished workouts at its first day', () => {
    expect(nextPlanDay([legs, push, pull], [])).toBe(push)
  })

  it('has no next day for a plan without days', () => {
    expect(nextPlanDay([], [workout(null, '2026-11-02T10:00:00.000Z')])).toBeUndefined()
  })

  it('follows the day of the latest finished workout, not the order they are given in', () => {
    const workouts = [
      workout(pull, '2026-11-04T10:00:00.000Z'),
      workout(push, '2026-11-02T10:00:00.000Z'),
    ]
    expect(nextPlanDay([push, pull, legs], workouts)).toBe(legs)
  })

  it('wraps round to the first day after the last one', () => {
    expect(nextPlanDay([push, pull, legs], [workout(legs, '2026-11-06T10:00:00.000Z')])).toBe(push)
  })

  it('ignores workouts in progress, deleted, started empty or from another plan', () => {
    const otherPlanDay = day(9, 'Arms', 0, { planId: '01960000-0000-7000-8000-0000000000f2' })
    const workouts = [
      workout(push, '2026-11-02T10:00:00.000Z'),
      workout(pull, '2026-11-04T10:00:00.000Z', { endedAt: null }),
      workout(legs, '2026-11-05T10:00:00.000Z', { deletedAt: DELETED }),
      workout(null, '2026-11-06T10:00:00.000Z'),
      workout(otherPlanDay, '2026-11-07T10:00:00.000Z'),
    ]
    expect(nextPlanDay([push, pull, legs], workouts)).toBe(pull)
  })

  it('skips deleted days and does not count a workout that followed one', () => {
    const deletedPull = { ...pull, deletedAt: DELETED }
    const workouts = [
      workout(push, '2026-11-02T10:00:00.000Z'),
      workout(deletedPull, '2026-11-04T10:00:00.000Z'),
    ]
    expect(nextPlanDay([push, deletedPull, legs], workouts)).toBe(legs)
  })
})

describe('suggestRestS', () => {
  it('rests a 5-rep squat longer than a 15-rep lateral raise', () => {
    expect(suggestRestS('compound', 5)).toBe(180)
    expect(suggestRestS('isolation', 15)).toBe(60)
  })

  it('takes the band that covers the low end of the rep range', () => {
    expect(suggestRestS('compound', 6)).toBe(150)
    expect(suggestRestS('compound', 8)).toBe(150)
    expect(suggestRestS('compound', 9)).toBe(120)
    expect(suggestRestS('compound', 20)).toBe(90)
    expect(suggestRestS('isolation', 8)).toBe(90)
    expect(suggestRestS('isolation', 12)).toBe(75)
  })
})
