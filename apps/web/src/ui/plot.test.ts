import { describe, expect, it } from 'vitest'

import { nearestIndex, niceDomain } from './plot'

describe('niceDomain', () => {
  it('rounds out to half kilos for a narrow span, with a round middle', () => {
    expect(niceDomain(61.8, 62.4)).toEqual([61.5, 62.5])
    expect(niceDomain(61.8, 62.6)).toEqual([61.5, 63.5])
  })

  it('widens the step with the span and keeps an even number of steps', () => {
    expect(niceDomain(58.2, 61.1)).toEqual([58, 62])
    expect(niceDomain(55.3, 62)).toEqual([54, 62])
  })

  it('gives a single value room above it', () => {
    expect(niceDomain(62, 62)).toEqual([62, 63])
  })
})

describe('nearestIndex', () => {
  it('snaps to the closest position, the earlier one on a tie', () => {
    expect(nearestIndex([0, 10, 20], 14)).toBe(1)
    expect(nearestIndex([0, 10, 20], 15)).toBe(1)
    expect(nearestIndex([0, 10, 20], 99)).toBe(2)
    expect(nearestIndex([0, 10, 20], -5)).toBe(0)
  })
})
