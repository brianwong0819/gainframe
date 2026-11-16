import { describe, expect, it } from 'vitest'

import { localDateSchema } from '../schemas/row.ts'
import type { Workout } from '../schemas/workout.ts'
import {
  estimateDurationS,
  lastOfPlanDay,
  summarizeWeek,
  totalWorkouts,
  weekDates,
} from './week.ts'
import type { WorkoutSummaryEntry } from './workout-summary.ts'

const date = (text: string) => localDateSchema.parse(text)
const PUSH = '01960000-0000-7000-8000-0000000000d1'
const PULL = '01960000-0000-7000-8000-0000000000d2'

function entry(
  n: number,
  localDate: string,
  planDayId: string | null,
  setsDone: number,
  volumeKg: number,
): WorkoutSummaryEntry {
  const workout: Workout = {
    id: `01960000-0000-7000-8000-00000000000${String(n)}`,
    userId: null,
    createdAt: `${localDate}T10:00:00.000Z`,
    updatedAt: `${localDate}T10:00:00.000Z`,
    deletedAt: null,
    startedAt: `${localDate}T10:00:00.000Z`,
    endedAt: `${localDate}T11:00:00.000Z`,
    planDayId,
    localDate: date(localDate),
    note: null,
    restStartedAt: null,
    restEndsAt: null,
  }
  return {
    workout,
    summary: { durationS: 3600, volumeKg, setsDone, recordCount: 0, exercises: [] },
  }
}

describe('weekDates', () => {
  it('runs Monday to Sunday around a midweek day', () => {
    expect(weekDates(date('2026-11-18'))).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ])
  })

  it('keeps a Monday first and a Sunday last', () => {
    expect(weekDates(date('2026-11-16'))[0]).toBe('2026-11-16')
    expect(weekDates(date('2026-11-22'))[6]).toBe('2026-11-22')
  })

  it('crosses a month, a year and a leap day', () => {
    expect(weekDates(date('2027-01-01'))[0]).toBe('2026-12-28')
    expect(weekDates(date('2028-03-01'))).toContain('2028-02-29')
  })
})

describe('summarizeWeek', () => {
  const entries = [
    entry(4, '2026-11-18', PUSH, 12, 3000),
    entry(3, '2026-11-18', null, 4, 500),
    entry(2, '2026-11-16', PULL, 10, 2500),
    entry(1, '2026-11-15', PUSH, 12, 2400),
  ]

  it('adds up the workouts of the week and leaves out the Sunday before', () => {
    expect(summarizeWeek(entries, date('2026-11-19'))).toMatchObject({
      workouts: 3,
      setsDone: 26,
      volumeKg: 6000,
    })
  })

  it('lists a day trained twice once', () => {
    expect(summarizeWeek(entries, date('2026-11-19')).trained).toEqual(['2026-11-16', '2026-11-18'])
  })

  it('is empty for a week without workouts', () => {
    expect(summarizeWeek(entries, date('2026-11-25'))).toMatchObject({
      trained: [],
      workouts: 0,
      setsDone: 0,
      volumeKg: 0,
    })
  })
})

describe('totalWorkouts', () => {
  it('adds up workouts, sets and volume, and is zero for none', () => {
    const entries = [entry(1, '2026-11-15', PUSH, 12, 2400), entry(2, '2026-11-16', null, 4, 500)]
    expect(totalWorkouts(entries)).toEqual({ workouts: 2, setsDone: 16, volumeKg: 2900 })
    expect(totalWorkouts([])).toEqual({ workouts: 0, setsDone: 0, volumeKg: 0 })
  })
})

describe('lastOfPlanDay', () => {
  const entries = [entry(1, '2026-11-15', PUSH, 12, 2400), entry(4, '2026-11-18', PUSH, 12, 3000)]

  it('finds the latest workout of the day whatever the order', () => {
    expect(lastOfPlanDay(entries, PUSH)?.summary.volumeKg).toBe(3000)
  })

  it('is null for a day never done', () => {
    expect(lastOfPlanDay(entries, PULL)).toBeNull()
  })
})

describe('estimateDurationS', () => {
  it('counts each set and the rest after it', () => {
    expect(
      estimateDurationS([
        { sets: 3, restS: 180 },
        { sets: 3, restS: 90 },
      ]),
    ).toBe(3 * (45 + 180) + 3 * (45 + 90))
  })

  it('is zero for a day without exercises', () => {
    expect(estimateDurationS([])).toBe(0)
  })
})
