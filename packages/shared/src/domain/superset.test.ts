import { describe, expect, it } from 'vitest'

import {
  earlierRoundToDo,
  type GroupedItem,
  linkedWithNext,
  linkWithNext,
  moveItem,
  restSlotAfter,
  type RoundSet,
  setOrder,
  sharedValueChanges,
  supersetBlocks,
  supersetLabels,
  supersetMembers,
  supersetValue,
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

describe('earlierRoundToDo', () => {
  const slots = items(0, 0, null)

  it('names the round in progress when a superset set belongs to a later one', () => {
    const roundOne = [...sets('s0', 3, 1), ...sets('s1', 3), ...sets('s2', 3)]
    expect(earlierRoundToDo(slots, roundOne, 's0', 1)).toBe(1)
    expect(earlierRoundToDo(slots, roundOne, 's1', 2)).toBe(1)
  })

  it('accepts any set of the round in progress, in either member', () => {
    const roundOne = [...sets('s0', 3), ...sets('s1', 3), ...sets('s2', 3)]
    expect(earlierRoundToDo(slots, roundOne, 's1', 0)).toBeNull()
    const roundTwo = [...sets('s0', 3, 1), ...sets('s1', 3, 1), ...sets('s2', 3)]
    expect(earlierRoundToDo(slots, roundTwo, 's0', 1)).toBeNull()
  })

  it('treats a standalone exercise’s sets as its rounds', () => {
    const third = [...sets('s0', 3), ...sets('s1', 3), ...sets('s2', 3, 1)]
    expect(earlierRoundToDo(slots, third, 's2', 2)).toBe(2)
    expect(earlierRoundToDo(slots, third, 's2', 1)).toBeNull()
  })

  it('ignores the sets of other exercises', () => {
    const others = [...sets('s0', 3), ...sets('s1', 3), ...sets('s2', 3, 1)]
    expect(earlierRoundToDo(slots, others, 's2', 1)).toBeNull()
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

describe('moveItem', () => {
  const order = (list: GroupedItem[], changes: { id: string; position: number }[]) => {
    const position = new Map(list.map((item) => [item.id, item.position]))
    for (const change of changes) position.set(change.id, change.position)
    return list
      .toSorted((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0))
      .map(({ id }) => id)
  }

  it('swaps a standalone item with its neighbour', () => {
    const list = items(null, null, null)
    expect(order(list, moveItem(list, 's2', -1))).toEqual(['s0', 's2', 's1'])
    expect(moveItem(list, 's0', -1)).toEqual([])
    expect(moveItem(list, 's2', 1)).toEqual([])
  })

  it('moves a standalone item past a whole superset', () => {
    const list = items(null, 0, 0, null)
    expect(order(list, moveItem(list, 's0', 1))).toEqual(['s1', 's2', 's0', 's3'])
    expect(order(list, moveItem(list, 's3', -1))).toEqual(['s0', 's3', 's1', 's2'])
  })

  it('swaps members inside a superset and moves the group from its edges', () => {
    const list = items(null, 0, 0)
    expect(order(list, moveItem(list, 's2', -1))).toEqual(['s0', 's2', 's1'])
    expect(order(list, moveItem(list, 's1', -1))).toEqual(['s1', 's2', 's0'])
    expect(moveItem(list, 's2', 1)).toEqual([])
  })

  it('renumbers positions from 0 after gaps left by deleted items', () => {
    const list = [
      { id: 'a', position: 2, supersetGroup: null },
      { id: 'b', position: 5, supersetGroup: null },
    ]
    expect(moveItem(list, 'b', -1)).toEqual([
      { id: 'b', position: 0 },
      { id: 'a', position: 1 },
    ])
  })
})

describe('supersetBlocks', () => {
  it('draws each superset as one block and each standalone item as its own', () => {
    const blocks = supersetBlocks(items(null, 3, 3, 7, 7, 0))
    expect(blocks.map(({ letter, items: list }) => [letter, list.map(({ id }) => id)])).toEqual([
      [null, ['s0']],
      ['A', ['s1', 's2']],
      ['B', ['s3', 's4']],
      [null, ['s5']],
    ])
  })
})

describe('superset values', () => {
  const withRest = (...rests: (number | null)[]) =>
    items(0, 0, null, 1, 1, 1).map((item, index) => ({ ...item, restS: rests[index] ?? null }))
  // A null rest stands for an exercise default of 60 s.
  const restOf = ({ restS }: { restS: number | null }) => restS ?? 60
  const stored = ({ restS }: { restS: number | null }) => restS

  it('lists the members of an item’s superset, or just the item', () => {
    const list = withRest()
    expect(supersetMembers(list, 's4').map(({ id }) => id)).toEqual(['s3', 's4', 's5'])
    expect(supersetMembers(list, 's2').map(({ id }) => id)).toEqual(['s2'])
    expect(supersetMembers(list, 'gone')).toEqual([])
  })

  it('takes the largest value of the members, defaults included', () => {
    expect(supersetValue(withRest(90, 120), restOf)).toBe(120)
    expect(supersetValue(withRest(30, null), restOf)).toBe(60)
  })

  it('gives every member of each superset its value and leaves the rest alone', () => {
    expect(sharedValueChanges(withRest(90, 120, 45, null, 75, 30), restOf, stored)).toEqual([
      { id: 's0', value: 120 },
      { id: 's3', value: 75 },
      { id: 's5', value: 75 },
    ])
    expect(sharedValueChanges(withRest(90, 90, 45, 60, 60, 60), restOf, stored)).toEqual([])
  })
})
