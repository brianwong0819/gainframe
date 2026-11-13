import { describe, expect, it } from 'vitest'

import { formatRepRange, withRepsMax, withRepsMin } from './item-edit'

describe('rep range edits', () => {
  it('formats a range, or one number when both ends are equal', () => {
    expect(formatRepRange({ repsMin: 8, repsMax: 12 })).toBe('8–12')
    expect(formatRepRange({ repsMin: 5, repsMax: 5 })).toBe('5')
  })

  it('moves the other end along so the range never inverts', () => {
    const range = { repsMin: 8, repsMax: 12 }
    expect(withRepsMin(range, 10)).toEqual({ repsMin: 10, repsMax: 12 })
    expect(withRepsMin(range, 14)).toEqual({ repsMin: 14, repsMax: 14 })
    expect(withRepsMax(range, 10)).toEqual({ repsMin: 8, repsMax: 10 })
    expect(withRepsMax(range, 6)).toEqual({ repsMin: 6, repsMax: 6 })
  })
})
