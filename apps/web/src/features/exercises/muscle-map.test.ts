import { describe, expect, it } from 'vitest'

import { muscleGroupSchema } from '@gainframe/shared'

import { FIGURE_PARTS } from './muscle-figure'
import { roleLevels } from './muscle-map'

describe('muscle figure', () => {
  it('draws every muscle group except full body', () => {
    const drawn = new Set<string>(FIGURE_PARTS.map(([part]) => part))
    for (const muscle of muscleGroupSchema.options) {
      expect(drawn.has(muscle)).toBe(muscle !== 'full_body')
    }
  })
})

describe('roleLevels', () => {
  it('fills the primary muscle with the accent and the secondary ones lightest', () => {
    expect(roleLevels('chest', ['triceps', 'shoulders'])).toEqual({
      chest: 3,
      triceps: 1,
      shoulders: 1,
    })
  })

  it('fills every group for a full-body exercise', () => {
    const levels = roleLevels('full_body', [])
    expect(Object.keys(levels)).toHaveLength(11)
    expect(new Set(Object.values(levels))).toEqual(new Set([3]))
  })

  it('leaves everything untrained when no muscle is picked yet', () => {
    expect(roleLevels(null, [])).toEqual({})
  })
})
