import { describe, expect, it } from 'vitest'

import { localDateSchema } from '../schemas/row.ts'
import {
  compositionChange,
  dailyWeights,
  rateStatus,
  targetRange,
  weeklyAverages,
  weeklyRate,
  weighInsNeeded,
  weightTrend,
} from './body-weight.ts'

const date = (text: string) => localDateSchema.parse(text)

function weighIn(localDate: string, weightKg: number, time = '07:00') {
  return { localDate: date(localDate), measuredAt: `${localDate}T${time}:00.000Z`, weightKg }
}

function scan(
  localDate: string,
  weightKg: number,
  bodyFatPct: number | null,
  fatMassKg: number | null,
) {
  return { ...weighIn(localDate, weightKg), bodyFatPct, fatMassKg }
}

// Fourteen mornings, 1 to 14 November: 60.0 kg in the first week and 60.3 kg
// in the second.
const twoWeeks = dailyWeights(
  Array.from({ length: 14 }, (_, index) =>
    weighIn(`2026-11-${String(index + 1).padStart(2, '0')}`, index < 7 ? 60 : 60.3),
  ),
)

describe('dailyWeights', () => {
  it('keeps the last weigh-in of each day, oldest day first', () => {
    const days = dailyWeights([
      weighIn('2026-11-02', 61),
      weighIn('2026-11-01', 60.4, '07:00'),
      weighIn('2026-11-01', 60.1, '21:00'),
    ])
    expect(days).toEqual([
      { localDate: '2026-11-01', weightKg: 60.1 },
      { localDate: '2026-11-02', weightKg: 61 },
    ])
  })
})

describe('weightTrend', () => {
  it('averages the weigh-ins of the seven days ending on each one, skipping missed days', () => {
    const trend = weightTrend(
      dailyWeights([
        weighIn('2026-11-01', 60),
        weighIn('2026-11-03', 61),
        weighIn('2026-11-07', 62),
        weighIn('2026-11-08', 63),
      ]),
    )
    expect(trend.map(({ averageKg }) => averageKg)).toEqual([60, 60.5, 61, 62])
  })
})

describe('weighInsNeeded and weeklyRate', () => {
  it('asks for seven weigh-ins and reports no rate before them', () => {
    const six = twoWeeks.slice(0, 6)
    expect(weighInsNeeded(six)).toBe(1)
    expect(weeklyRate(six)).toBeNull()
    expect(weighInsNeeded(twoWeeks)).toBe(0)
  })

  it('compares the last week with the week before', () => {
    const rate = weeklyRate(twoWeeks)
    expect(rate?.kgPerWeek).toBeCloseTo(0.3)
    expect(rate?.pctPerWeek).toBeCloseTo(0.5)
  })

  it('reports no rate when the week before has no weigh-in', () => {
    const lastWeekOnly = twoWeeks.slice(7)
    expect(weeklyRate(lastWeekOnly)).toBeNull()
  })
})

describe('weeklyAverages', () => {
  it('lists seven-day spans ending on the last weigh-in, newest first', () => {
    const weeks = weeklyAverages(twoWeeks, 5)
    expect(weeks).toHaveLength(2)
    expect(weeks[0]).toMatchObject({ from: '2026-11-08', to: '2026-11-14' })
    expect(weeks[0]?.averageKg).toBeCloseTo(60.3)
    expect(weeks[0]?.changeKg).toBeCloseTo(0.3)
    expect(weeks[1]).toEqual({
      from: '2026-11-01',
      to: '2026-11-07',
      averageKg: 60,
      changeKg: null,
    })
  })

  it('stops at the count and leaves out a span without a weigh-in', () => {
    const gap = dailyWeights([
      weighIn('2026-10-20', 59),
      weighIn('2026-11-03', 60),
      weighIn('2026-11-10', 61),
    ])
    expect(weeklyAverages(gap, 1).map(({ to }) => to)).toEqual(['2026-11-10'])
    const weeks = weeklyAverages(gap, 5)
    expect(weeks.map(({ to }) => to)).toEqual(['2026-11-10', '2026-11-03', '2026-10-20'])
    // The span before 3 November has no weigh-in, so its change is unknown.
    expect(weeks.map(({ changeKg }) => changeKg)).toEqual([1, null, null])
  })

  it('is empty before the first weigh-in', () => {
    expect(weeklyAverages([], 5)).toEqual([])
  })
})

describe('rateStatus', () => {
  it('reads a gain against 0.25 to 0.5% a week, the default phase', () => {
    expect(rateStatus(0.1, null)).toBe('tooSlow')
    expect(rateStatus(0.4, 'bulk')).toBe('onTarget')
    expect(rateStatus(0.8, 'bulk')).toBe('tooFast')
  })

  it('reads a cut in its own direction', () => {
    expect(rateStatus(-0.2, 'cut')).toBe('tooSlow')
    expect(rateStatus(-0.7, 'cut')).toBe('onTarget')
    expect(rateStatus(-1.5, 'cut')).toBe('tooFast')
  })

  it('reads maintaining as on or off target', () => {
    expect(rateStatus(0.1, 'maintain')).toBe('onTarget')
    expect(rateStatus(0.4, 'maintain')).toBe('offTarget')
    expect(rateStatus(-0.4, 'maintain')).toBe('offTarget')
  })
})

describe('targetRange', () => {
  it('widens from the start weight at the minimum and maximum rates', () => {
    const range = targetRange(
      60,
      date('2026-11-01'),
      [date('2026-11-01'), date('2026-11-15')],
      'bulk',
    )
    expect(range[0]).toEqual({ localDate: '2026-11-01', lowKg: 60, highKg: 60 })
    expect(range[1]?.lowKg).toBeCloseTo(60.3)
    expect(range[1]?.highKg).toBeCloseTo(60.6)
  })
})

describe('compositionChange', () => {
  it('compares the first and latest scans, from fat mass or body fat %', () => {
    const change = compositionChange([
      scan('2026-12-01', 62, null, 9),
      scan('2026-10-01', 60, 15, null),
      scan('2026-11-01', 61, null, null),
    ])
    expect(change?.from).toBe('2026-10-01')
    expect(change?.to).toBe('2026-12-01')
    expect(change?.weightKg).toBeCloseTo(2)
    expect(change?.fatKg).toBeCloseTo(0)
    expect(change?.leanKg).toBeCloseTo(2)
  })

  it('needs two scans; weight-only weigh-ins never count', () => {
    expect(
      compositionChange([scan('2026-10-01', 60, 15, null), scan('2026-11-01', 61, null, null)]),
    ).toBeNull()
  })
})
