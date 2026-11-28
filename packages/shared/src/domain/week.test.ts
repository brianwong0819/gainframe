import { describe, expect, it } from 'vitest'

import { localDateSchema } from '../schemas/row.ts'
import type { Workout, WorkoutSet } from '../schemas/workout.ts'
import {
  averageFullWeeks,
  estimateDurationS,
  lastOfPlanDay,
  summarizeWeek,
  totalWorkouts,
  weekDates,
  weeklyVolume,
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

describe('weeklyVolume', () => {
  const BENCH = '01960000-0000-7000-8000-0000000000e1'
  const BURPEE = '01960000-0000-7000-8000-0000000000e2'
  const row = { userId: null, createdAt: '', updatedAt: '', deletedAt: null }
  function workout(id: string, localDate: string, deletedAt: string | null = null): Workout {
    return {
      ...row,
      deletedAt,
      id,
      startedAt: `${localDate}T10:00:00.000Z`,
      endedAt: null,
      planDayId: null,
      localDate: date(localDate),
      note: null,
      restStartedAt: null,
      restEndsAt: null,
    }
  }
  let next = 0
  function set(workoutId: string, fields: Partial<WorkoutSet> = {}): WorkoutSet {
    next += 1
    return {
      ...row,
      id: String(next),
      workoutExerciseId: 'slot',
      workoutId,
      exerciseId: BENCH,
      position: next,
      kind: 'working',
      weightKg: 50,
      reps: 10,
      rpe: null,
      completedAt: '2026-11-01T10:00:00.000Z',
      ...fields,
    }
  }
  const load = { isBodyweight: () => false, bodyWeightKg: null }
  // Today is Wednesday 2026-11-25; its week runs from 11-23 to 11-29.
  const today = date('2026-11-25')
  const workouts = [
    workout('now', '2026-11-24'),
    workout('last', '2026-11-16'),
    workout('sunday', '2026-11-22'),
    workout('gone', '2026-11-17', '2026-11-18T00:00:00.000Z'),
    workout('old', '2026-09-01'),
  ]
  const sets = [
    set('now'),
    set('now', { exerciseId: BURPEE, weightKg: 0 }),
    set('now', { kind: 'warmup' }),
    set('now', { completedAt: null }),
    set('now', { deletedAt: '2026-11-24T11:00:00.000Z' }),
    set('last'),
    set('sunday', { weightKg: 60 }),
    set('gone'),
    set('old'),
  ]
  const weeks = weeklyVolume({ workouts, sets, load, today })

  it('gives twelve Monday-to-Sunday weeks ending with the week in progress', () => {
    expect(weeks).toHaveLength(12)
    expect(weeks.at(-1)).toMatchObject({ from: '2026-11-23', to: '2026-11-29' })
    expect(weeks[0]).toMatchObject({ from: '2026-09-07', to: '2026-09-13' })
  })

  it('counts a week in progress, including an exercise without a muscle group', () => {
    expect(weeks.at(-1)).toMatchObject({ sets: 2, volumeKg: 500 })
  })

  it('puts a Sunday workout in its own week and skips deleted workouts', () => {
    expect(weeks.at(-2)).toMatchObject({ from: '2026-11-16', sets: 2, volumeKg: 1100 })
  })

  it('keeps a week with no workout as zero', () => {
    expect(weeks.at(-3)).toMatchObject({ sets: 0, volumeKg: 0 })
  })

  it('averages the full weeks since the first workout, without the week in progress', () => {
    expect(averageFullWeeks(weeks, ({ sets }) => sets)).toBe(2)
    const sparse = weeks.map((week, index) => (index === 8 ? { ...week, sets: 4 } : week))
    expect(averageFullWeeks(sparse, ({ sets }) => sets)).toBe(2)
    expect(averageFullWeeks(weeks.slice(-1), ({ sets }) => sets)).toBeNull()
  })
})
