import { describe, expect, it } from 'vitest'

import { formatClock } from './clock'

describe('formatClock', () => {
  it('shows minutes and seconds below an hour', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(7)).toBe('0:07')
    expect(formatClock(872)).toBe('14:32')
    expect(formatClock(3599)).toBe('59:59')
  })

  it('adds hours from an hour on', () => {
    expect(formatClock(3600)).toBe('1:00:00')
    expect(formatClock(3725)).toBe('1:02:05')
  })

  it('never goes below zero and drops fractions', () => {
    expect(formatClock(-5)).toBe('0:00')
    expect(formatClock(59.9)).toBe('0:59')
  })
})
