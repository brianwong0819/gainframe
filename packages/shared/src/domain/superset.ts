// Supersets: exercises with the same `supersetGroup` are performed alternately,
// one set of each in turn (a round), and the rest comes only after the round.
// The same rules serve workout slots and plan items. Callers pass live rows
// only; a group left with one live member is a standalone exercise.

export interface GroupedItem {
  id: string
  position: number
  supersetGroup: number | null
}

export interface RoundSet {
  workoutExerciseId: string
  position: number
  completedAt: string | null
}

export interface GroupChange {
  id: string
  supersetGroup: number | null
}

const byPosition = <T extends GroupedItem>(items: readonly T[]): T[] =>
  items.toSorted((a, b) => a.position - b.position)

// The members of each group that has at least two items, in order.
function groups<T extends GroupedItem>(items: readonly T[]): Map<number, T[]> {
  const members = new Map<number, T[]>()
  for (const item of byPosition(items)) {
    if (item.supersetGroup === null) continue
    members.set(item.supersetGroup, [...(members.get(item.supersetGroup) ?? []), item])
  }
  for (const [group, list] of members) if (list.length < 2) members.delete(group)
  return members
}

// The other members of an item's superset, itself included; just the item when
// it stands alone.
function membersOf<T extends GroupedItem>(items: readonly T[], item: T): T[] {
  return item.supersetGroup === null ? [item] : (groups(items).get(item.supersetGroup) ?? [item])
}

// Labels for the items of each superset: "A1", "A2" for the first group in the
// day, "B1", "B2" for the next. Standalone items have no label.
export function supersetLabels(items: readonly GroupedItem[]): Map<string, string> {
  const labels = new Map<string, string>()
  for (const [index, members] of [...groups(items).values()].entries()) {
    const letter = String.fromCharCode(65 + (index % 26))
    for (const [n, item] of members.entries()) labels.set(item.id, `${letter}${String(n + 1)}`)
  }
  return labels
}

// The order to do the sets in: a standalone exercise's sets one after another,
// a superset's sets round by round (A1 set 1, A2 set 1, A1 set 2, …), where a
// member with fewer sets simply drops out of the later rounds. `slots` and each
// slot's `sets` come in display order.
export function setOrder<S>(slots: readonly { slot: GroupedItem; sets: readonly S[] }[]): S[] {
  const all = slots.map(({ slot }) => slot)
  const setsOf = new Map(slots.map(({ slot, sets }) => [slot.id, sets]))
  const done = new Set<string>()
  const order: S[] = []
  for (const { slot } of slots) {
    if (done.has(slot.id)) continue
    const members = membersOf(all, slot)
    const rounds = Math.max(...members.map(({ id }) => setsOf.get(id)?.length ?? 0))
    for (let round = 0; round < rounds; round += 1) {
      for (const { id } of members) {
        const set = setsOf.get(id)?.[round]
        if (set !== undefined) order.push(set)
      }
    }
    for (const { id } of members) done.add(id)
  }
  return order
}

// The slot whose rest follows a set just completed, or null when the set does
// not end its round. A standalone set ends its own round. A superset's round
// ends once no member has a set still to do in this round or an earlier one
// (the n-th set of a slot is in round n), and its rest is the last member's,
// whichever member finished the round.
export function restSlotAfter(
  slots: readonly GroupedItem[],
  sets: readonly RoundSet[],
  slotId: string,
  setPosition: number,
): string | null {
  const slot = slots.find(({ id }) => id === slotId)
  if (slot === undefined) return null
  const members = membersOf(slots, slot)
  const roundOf = (set: RoundSet) =>
    sets.filter(
      (other) => other.workoutExerciseId === set.workoutExerciseId && other.position < set.position,
    ).length
  const round = roundOf({ workoutExerciseId: slotId, position: setPosition, completedAt: null })
  const memberIds = new Set(members.map(({ id }) => id))
  const pending = sets.some(
    (set) =>
      memberIds.has(set.workoutExerciseId) && set.completedAt === null && roundOf(set) <= round,
  )
  if (pending) return null
  return members.at(-1)?.id ?? null
}

function unusedGroup(items: readonly GroupedItem[]): number {
  return items.reduce((max, item) => Math.max(max, (item.supersetGroup ?? -1) + 1), 0)
}

// Joins an item with the one after it into a superset; joining two groups
// merges them. Returns only the items whose group changes.
export function linkWithNext(items: readonly GroupedItem[], id: string): GroupChange[] {
  const ordered = byPosition(items)
  const index = ordered.findIndex((item) => item.id === id)
  const item = ordered[index]
  const next = ordered[index + 1]
  if (item === undefined || next === undefined) return []
  const group = item.supersetGroup ?? next.supersetGroup ?? unusedGroup(items)
  const joining = [...membersOf(items, item), ...membersOf(items, next)]
  return joining
    .filter((member) => member.supersetGroup !== group)
    .map((member) => ({ id: member.id, supersetGroup: group }))
}

// Splits a superset between an item and the one after it. Each side keeps
// alternating if it still has two or more items (the later side under a new
// group); a side left with one item becomes standalone.
export function unlinkFromNext(items: readonly GroupedItem[], id: string): GroupChange[] {
  const item = items.find((other) => other.id === id)
  if (item === undefined) return []
  const members = membersOf(items, item)
  const split = members.findIndex((member) => member.id === id) + 1
  if (split === members.length) return []
  const before = members.slice(0, split)
  const after = members.slice(split)
  const newGroup = unusedGroup(items)
  return [
    ...(before.length === 1 ? before.map(({ id: one }) => ({ id: one, supersetGroup: null })) : []),
    ...after.map((member) => ({
      id: member.id,
      supersetGroup: after.length === 1 ? null : newGroup,
    })),
  ]
}

// Whether an item and the one after it are in the same superset.
export function linkedWithNext(items: readonly GroupedItem[], id: string): boolean {
  const ordered = byPosition(items)
  const index = ordered.findIndex((item) => item.id === id)
  const item = ordered[index]
  const next = ordered[index + 1]
  if (item === undefined || next === undefined || item.supersetGroup === null) return false
  return next.supersetGroup === item.supersetGroup
}
