import { describe, expect, it } from 'vitest'

import { estimateDayS, itemRestS } from './estimate'

// The built-in barbell bench press, which rests 180 s by default.
const BENCH = '00000000-0000-7000-8000-000000000001'

describe('plan day estimate', () => {
  it("uses the item's rest, else the exercise's default", () => {
    expect(itemRestS({ exerciseId: BENCH, restS: 90 }, [])).toBe(90)
    expect(itemRestS({ exerciseId: BENCH, restS: null }, [])).toBe(180)
  })

  it('rounds a day to five minutes, with five as the least', () => {
    // 3 × (45 + 180) s = 11 min 15 s.
    expect(estimateDayS([{ exerciseId: BENCH, restS: null, targetSets: 3 }], [])).toBe(600)
    expect(estimateDayS([{ exerciseId: BENCH, restS: 0, targetSets: 1 }], [])).toBe(300)
    expect(estimateDayS([], [])).toBe(0)
  })
})
