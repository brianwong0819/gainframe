import { describe, expect, it } from 'vitest'

import { proteinPace } from './protein-pace.ts'

// The window in config runs from 07:00 to 21:00 with a margin of 10% of the target.
describe('proteinPace', () => {
  it('is met once the target is reached, whatever the hour', () => {
    expect(proteinPace(140, 140, 9)).toEqual({ status: 'met' })
    expect(proteinPace(150, 140, null)).toEqual({ status: 'met' })
  })

  it('judges nothing before the eating window opens', () => {
    expect(proteinPace(0, 140, 6.5)).toEqual({ status: 'early' })
    expect(proteinPace(0, 140, 7)).toEqual({ status: 'early' })
  })

  it('is on pace within the margin of the straight line to the target', () => {
    // Halfway through the window (14:00) the line is at 70 g; the margin is 14 g.
    expect(proteinPace(70, 140, 14)).toEqual({ status: 'onPace' })
    expect(proteinPace(56, 140, 14)).toEqual({ status: 'onPace' })
  })

  it('is behind below the margin, with the amount expected by now', () => {
    expect(proteinPace(55, 140, 14)).toEqual({ status: 'behind', expectedG: 70 })
  })

  it('expects the whole target after the window closes', () => {
    expect(proteinPace(100, 140, 22.5)).toEqual({ status: 'behind', expectedG: 140 })
  })

  it('reports a day that is over and short as missed, with the share reached', () => {
    expect(proteinPace(105, 140, null)).toEqual({ status: 'missed', share: 0.75 })
  })
})
