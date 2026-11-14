import { describe, expect, it } from 'vitest'

import {
  type GroupedItem,
  linkedWithNext,
  linkWithNext,
  restSlotAfter,
  type RoundSet,
  setOrder,
  supersetLabels,
  unlinkFromNext,
} from './superset.ts'

function items(...groups: (number | null)[]): GroupedItem[] {
  return groups.map((supersetGroup, position) => ({
    id: `s${String(position)}`,
    position,
    supersetGroup,
  }))
}

function sets(slotId: string, count: number, done = 0): (RoundSet & { id: string })[] {
  return Array.from({ length: count }, (_, position) => ({
    id: `${slotId}-${String(position + 1)}`,
    workoutExerciseId: slotId,
    position,
    completedAt: position < done ? '2026-11-14T10:00:00.000Z' : null,
  }))
}

describe('supersetLabels', () => {
  it('labels each group by letter and member, skipping standalone items', () => {
    const labels = supersetLabels(items(null, 3, 3, null, 7, 7, 7))
    expect([...labels]).toEqual([
      ['s1', 'A1'],
      ['s2', 'A2'],
      ['s4', 'B1'],
      ['s5', 'B2'],
      ['s6', 'B3'],
    ])
  })

  it('treats a group with one item left as standalone', () => {
    expect(supersetLabels(items(0, null)).size).toBe(0)
  })
})

describe('setOrder', () => {
  it('alternates a superset round by round and keeps standalone sets in a row', () => {
    const counts = [2, 3, 2, 1]
    const order = setOrder(
      items(null, 1, 1, null).map((slot, n) => ({ slot, sets: sets(slot.id, counts[n] ?? 0) })),
    ).map(({ id }) => id)
    expect(order).toEqual(['s0-1', 's0-2', 's1-1', 's2-1', 's1-2', 's2-2', 's1-3', 's3-1'])
  })
})

describe('restSlotAfter', () => {
  const slots = items(0, 0, null)

  it('starts the rest only after the last set of a round', () => {
    const roundOne = [...sets('s0', 3, 1), ...sets('s1', 3), ...sets('s2', 3)]
    expect(restSlotAfter(slots, roundOne, 's0', 0)).toBeNull()
    const roundDone = [...sets('s0', 3, 1), ...sets('s1', 3, 1), ...sets('s2', 3)]
    expect(restSlotAfter(slots, roundDone, 's1', 0)).toBe('s1')
  })

  it('takes the last member’s rest when the round ends on an earlier member', () => {
    const outOfOrder = [...sets('s0', 3, 1), ...sets('s1', 3, 1), ...sets('s2', 3)]
    expect(restSlotAfter(slots, outOfOrder, 's0', 0)).toBe('s1')
  })

  it('rests after every set of a member whose partners have run out of sets', () => {
    const uneven = [...sets('s0', 4, 4), ...sets('s1', 3, 3)]
    expect(restSlotAfter(slots, uneven, 's0', 3)).toBe('s1')
  })

  it('rests after every set of a standalone exercise', () => {
    expect(restSlotAfter(slots, sets('s2', 3, 1), 's2', 0)).toBe('s2')
  })
})

describe('linkWithNext', () => {
  it('starts a new group for two standalone items', () => {
    expect(linkWithNext(items(null, null, 0, 0), 's0')).toEqual([
      { id: 's0', supersetGroup: 1 },
      { id: 's1', supersetGroup: 1 },
    ])
  })

  it('adds an item to the group after it, and merges two groups', () => {
    expect(linkWithNext(items(null, 4, 4), 's0')).toEqual([{ id: 's0', supersetGroup: 4 }])
    expect(linkWithNext(items(2, 2, 5, 5), 's1')).toEqual([
      { id: 's2', supersetGroup: 2 },
      { id: 's3', supersetGroup: 2 },
    ])
  })

  it('does nothing for the last item', () => {
    expect(linkWithNext(items(null, null), 's1')).toEqual([])
  })
})

describe('unlinkFromNext', () => {
  it('makes both items standalone when a pair is split', () => {
    expect(unlinkFromNext(items(0, 0), 's0')).toEqual([
      { id: 's0', supersetGroup: null },
      { id: 's1', supersetGroup: null },
    ])
  })

  it('keeps each side of a split triple-or-more alternating when it can', () => {
    expect(unlinkFromNext(items(0, 0, 0, 0), 's1')).toEqual([
      { id: 's2', supersetGroup: 1 },
      { id: 's3', supersetGroup: 1 },
    ])
    expect(unlinkFromNext(items(0, 0, 0), 's1')).toEqual([{ id: 's2', supersetGroup: null }])
  })

  it('does nothing between items that are not linked', () => {
    expect(unlinkFromNext(items(0, 0, null), 's1')).toEqual([])
  })
})

describe('linkedWithNext', () => {
  it('is true only between two members of the same group', () => {
    const list = items(0, 0, null, 0)
    expect(['s0', 's1', 's2', 's3'].map((id) => linkedWithNext(list, id))).toEqual([
      true,
      false,
      false,
      false,
    ])
  })
})
