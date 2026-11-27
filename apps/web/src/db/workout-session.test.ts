import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fromKg, toKg } from '@gainframe/shared'

import { createRepositories, type Repositories } from './repositories'
import { GainframeDb } from './schema'
import { createWorkoutSession, type WorkoutSession } from './workout-session'

const BENCH = '01960000-0000-7000-8000-000000000001'
const SQUAT = '01960000-0000-7000-8000-000000000002'
const ZONE = 'Asia/Kuala_Lumpur'

let db: GainframeDb
let repos: Repositories
let session: WorkoutSession
let clock: Date

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  clock = new Date('2026-11-08T10:00:00.000Z')
  repos = createRepositories(db, () => clock)
  session = createWorkoutSession(db, repos, () => clock)
})

afterEach(() => {
  db.close()
})

function advance(ms: number) {
  clock = new Date(clock.getTime() + ms)
}

async function complete(setId: string, weightKg: number, reps: number) {
  advance(60_000)
  return repos.workoutSets.update(setId, {
    weightKg,
    reps,
    completedAt: clock.toISOString(),
  })
}

describe('start', () => {
  it("starts an empty workout on the user's local date", async () => {
    clock = new Date('2026-11-08T17:30:00.000Z')
    const workout = await session.start(ZONE)
    expect(workout).toMatchObject({ endedAt: null, planDayId: null, localDate: '2026-11-09' })
    expect(await session.findActive()).toEqual(workout)
  })

  it('resumes the workout in progress instead of starting a second one', async () => {
    const first = await session.start(ZONE)
    advance(1000)
    expect(await session.start(ZONE)).toEqual(first)
    expect(await db.workouts.count()).toBe(1)
  })

  it('starts a new workout once the last one has finished', async () => {
    const first = await session.start(ZONE)
    advance(1000)
    await session.finish(first.id)
    expect(await session.findActive()).toBeUndefined()
    const second = await session.start(ZONE)
    expect(second.id).not.toBe(first.id)
  })

  it('ignores a deleted unfinished workout', async () => {
    const first = await session.start(ZONE)
    await repos.workouts.remove(first.id)
    expect(await session.findActive()).toBeUndefined()
  })
})

describe('loadActive', () => {
  it('is null when no workout is open', async () => {
    expect(await session.loadActive()).toBeNull()
  })

  it("lists live slots and sets in order, with last time's sets", async () => {
    const monday = await session.start(ZONE)
    const old = await session.addExercise(monday.id, BENCH)
    const [oldSet] = await db.workoutSets.where('workoutExerciseId').equals(old.id).toArray()
    await complete(oldSet?.id ?? '', 60, 8)
    await session.finish(monday.id)

    advance(86_400_000)
    const workout = await session.start(ZONE)
    const bench = await session.addExercise(workout.id, BENCH)
    const removed = await session.addExercise(workout.id, SQUAT)
    await repos.workoutExercises.remove(removed.id)
    const second = await session.addSet(bench.id)

    const state = await session.loadActive()
    expect(state?.workout.id).toBe(workout.id)
    expect(state?.slots.map(({ slot }) => slot.id)).toEqual([bench.id])
    expect(state?.slots[0]?.sets.map((set) => set.position)).toEqual([0, second.position])
    expect(state?.slots[0]?.previous.map((set) => set.id)).toEqual([oldSet?.id])
  })
})

describe('addExercise and addSet', () => {
  it('appends slots in order, each with one planned set', async () => {
    const workout = await session.start(ZONE)
    const bench = await session.addExercise(workout.id, BENCH)
    const squat = await session.addExercise(workout.id, SQUAT)
    expect([bench.position, squat.position]).toEqual([0, 1])

    const sets = await db.workoutSets.where('workoutExerciseId').equals(bench.id).toArray()
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({
      workoutId: workout.id,
      exerciseId: BENCH,
      position: 0,
      kind: 'working',
      weightKg: 0,
      reps: 8,
      completedAt: null,
    })
  })

  it("prefills each set from last time's set with the same index", async () => {
    const monday = await session.start(ZONE)
    const slot = await session.addExercise(monday.id, BENCH)
    const [first] = await db.workoutSets.where('workoutExerciseId').equals(slot.id).toArray()
    await complete(first?.id ?? '', 60, 8)
    const second = await session.addSet(slot.id)
    await complete(second.id, 62.5, 6)
    await session.finish(monday.id)

    advance(86_400_000)
    const thursday = await session.start(ZONE)
    const today = await session.addExercise(thursday.id, BENCH)
    const sets = [
      ...(await db.workoutSets.where('workoutExerciseId').equals(today.id).toArray()),
      await session.addSet(today.id),
      await session.addSet(today.id),
    ]
    expect(sets.map((set) => [set.position, set.weightKg, set.reps])).toEqual([
      [0, 60, 8],
      [1, 62.5, 6],
      [2, 62.5, 6],
    ])
  })

  it('does not reuse the position of a deleted set', async () => {
    const workout = await session.start(ZONE)
    const slot = await session.addExercise(workout.id, BENCH)
    const second = await session.addSet(slot.id)
    await repos.workoutSets.remove(second.id)
    expect((await session.addSet(slot.id)).position).toBe(2)
  })

  it('records every write in the outbox', async () => {
    const workout = await session.start(ZONE)
    const slot = await session.addExercise(workout.id, BENCH)
    const rows = (await db.outbox.toArray()).map(({ table, rowId }) => ({ table, rowId }))
    expect(rows.slice(0, 2)).toEqual([
      { table: 'workouts', rowId: workout.id },
      { table: 'workoutExercises', rowId: slot.id },
    ])
    expect(rows[2]?.table).toBe('workoutSets')
  })

  it('rejects a slot that was deleted', async () => {
    const workout = await session.start(ZONE)
    const slot = await session.addExercise(workout.id, BENCH)
    await repos.workoutExercises.remove(slot.id)
    await expect(session.addSet(slot.id)).rejects.toThrow('No exercise slot')
  })
})

describe('stepWeight and stepReps', () => {
  async function firstSetId() {
    const workout = await session.start(ZONE)
    const slot = await session.addExercise(workout.id, BENCH)
    const [set] = await db.workoutSets.where('workoutExerciseId').equals(slot.id).toArray()
    return set?.id ?? ''
  }

  it('applies quick taps to the stored value and stops at 0', async () => {
    const id = await firstSetId()
    await Promise.all([1, 2, 3].map(() => session.stepWeight(id, 2.5, 1, 'kg')))
    expect((await repos.workoutSets.get(id))?.weightKg).toBe(7.5)
    await session.stepReps(id, -20)
    expect((await repos.workoutSets.get(id))?.reps).toBe(0)
    for (let tap = 0; tap < 4; tap += 1) await session.stepWeight(id, 2.5, -1, 'kg')
    expect((await repos.workoutSets.get(id))?.weightKg).toBe(0)
  })

  it('steps in whole pounds when the weight is shown in pounds', async () => {
    const id = await firstSetId()
    await repos.workoutSets.update(id, { weightKg: toKg(45, 'lb') })
    for (let tap = 0; tap < 20; tap += 1) await session.stepWeight(id, 5, 1, 'lb')
    const weightKg = (await repos.workoutSets.get(id))?.weightKg ?? 0
    expect(fromKg(weightKg, 'lb')).toBe(145)
    expect(weightKg).toBe(65.77)
  })

  it('lands a weight converted from pounds on the kg grid', async () => {
    const id = await firstSetId()
    await repos.workoutSets.update(id, { weightKg: toKg(10, 'lb') })
    await session.stepWeight(id, 2.5, 1, 'kg')
    expect((await repos.workoutSets.get(id))?.weightKg).toBe(5)
    await repos.workoutSets.update(id, { weightKg: toKg(10, 'lb') })
    await session.stepWeight(id, 2.5, -1, 'kg')
    expect((await repos.workoutSets.get(id))?.weightKg).toBe(2.5)
  })
})

describe('setWeight', () => {
  it("moves a done set's later sets that are still at its old weight", async () => {
    const workout = await session.start(ZONE)
    const slot = await session.addExercise(workout.id, BENCH)
    const [first] = await db.workoutSets.where('workoutExerciseId').equals(slot.id).toArray()
    const second = await session.addSet(slot.id)
    const third = await session.addSet(slot.id)
    for (const { id } of [second, third]) await repos.workoutSets.update(id, { weightKg: 36.25 })
    await repos.workoutSets.update(third.id, { weightKg: 40 })
    await complete(first?.id ?? '', 36.25, 8)

    await session.setWeight(first?.id ?? '', 38.75)
    expect((await repos.workoutSets.get(first?.id ?? ''))?.weightKg).toBe(38.75)
    expect((await repos.workoutSets.get(second.id))?.weightKg).toBe(38.75)
    expect((await repos.workoutSets.get(third.id))?.weightKg).toBe(40)

    await session.stepWeight(first?.id ?? '', 2.5, 1, 'kg')
    expect((await repos.workoutSets.get(second.id))?.weightKg).toBe(40)
  })

  it('leaves later sets alone while the edited set is not done', async () => {
    const workout = await session.start(ZONE)
    const slot = await session.addExercise(workout.id, BENCH)
    const [first] = await db.workoutSets.where('workoutExerciseId').equals(slot.id).toArray()
    const second = await session.addSet(slot.id)
    await session.setWeight(first?.id ?? '', 50)
    expect((await repos.workoutSets.get(second.id))?.weightKg).toBe(second.weightKg)
  })
})

describe('startFromPlanDay', () => {
  async function pushDay() {
    const plan = await repos.plans.create({ name: 'Push Pull Legs', activatedAt: null })
    const day = await repos.planDays.create({ planId: plan.id, name: 'Push', position: 0 })
    const item = (exerciseId: string, position: number, targetSets: number, restS: number | null) =>
      repos.planItems.create({
        planId: plan.id,
        planDayId: day.id,
        exerciseId,
        position,
        supersetGroup: null,
        targetSets,
        repsMin: 8,
        repsMax: 12,
        restS,
        note: restS === null ? null : 'Seat at notch 4',
      })
    await item(SQUAT, 1, 2, null)
    await item(BENCH, 0, 3, 150)
    return day
  }

  it("lays out the day's exercises in order with their target sets, range and rest", async () => {
    const day = await pushDay()
    const workout = await session.startFromPlanDay(day.id, ZONE)
    expect(workout.planDayId).toBe(day.id)

    const state = await session.loadActive()
    expect(state?.slots.map(({ slot }) => [slot.exerciseId, slot.restS])).toEqual([
      [BENCH, 150],
      [SQUAT, null],
    ])
    expect(state?.slots[0]?.slot).toMatchObject({ repsMin: 8, repsMax: 12, note: null })
    // The plan's note is copied; the workout's own note starts empty.
    expect(state?.slots.map(({ slot }) => slot.planNote)).toEqual(['Seat at notch 4', null])
    expect(state?.slots.map(({ sets }) => sets.length)).toEqual([3, 2])
    // Never done before: the default weight, and the low end of the rep range.
    expect(state?.slots[0]?.sets.map((set) => [set.weightKg, set.reps])).toEqual([
      [0, 8],
      [0, 8],
      [0, 8],
    ])
  })

  it("prefills last time's weights and shows the best weight of earlier workouts", async () => {
    const day = await pushDay()
    const first = await session.startFromPlanDay(day.id, ZONE)
    const firstState = await session.loadActive()
    const [heavy, light] = firstState?.slots[0]?.sets ?? []
    if (heavy === undefined || light === undefined) throw new Error('No sets')
    await complete(heavy.id, 70, 9)
    await complete(light.id, 65, 11)
    await session.finish(first.id)

    advance(86_400_000)
    await session.startFromPlanDay(day.id, ZONE)
    const state = await session.loadActive()
    expect(state?.slots[0]?.sets.map((set) => [set.weightKg, set.reps])).toEqual([
      [70, 8],
      [65, 8],
      [65, 8],
    ])
    expect(state?.slots[0]?.bestKg).toBe(70)
    expect(state?.slots[1]?.bestKg).toBeNull()
  })

  it("carries a completed set's weight to the later sets that have none yet", async () => {
    const day = await pushDay()
    const first = await session.startFromPlanDay(day.id, ZONE)
    const [one, two, three] = (await session.loadActive())?.slots[0]?.sets ?? []
    if (one === undefined || two === undefined || three === undefined) throw new Error('No sets')
    await repos.workoutSets.update(one.id, { weightKg: 70 })
    await session.completeSet(one.id)
    const weights = async () =>
      (await session.loadActive())?.slots[0]?.sets.map((set) => set.weightKg)
    expect(await weights()).toEqual([70, 70, 70])

    // A lighter second set leaves the third as it is: it has a weight now.
    await repos.workoutSets.update(two.id, { weightKg: 65 })
    await session.completeSet(two.id)
    expect(await weights()).toEqual([70, 65, 70])
    // The other exercise of the day is untouched.
    expect((await session.loadActive())?.slots[1]?.sets.map((set) => set.weightKg)).toEqual([0, 0])
    await session.finish(first.id)
  })

  it('resumes the workout in progress instead', async () => {
    const day = await pushDay()
    const active = await session.start(ZONE)
    expect(await session.startFromPlanDay(day.id, ZONE)).toEqual(active)
    expect(await db.workoutExercises.count()).toBe(0)
  })
})

describe('moveSlot', () => {
  it('moves an exercise and keeps a superset together', async () => {
    const workout = await session.start(ZONE)
    const bench = await session.addExercise(workout.id, BENCH)
    const squat = await session.addExercise(workout.id, SQUAT)
    const row = await session.addExercise(workout.id, '01960000-0000-7000-8000-000000000003')
    await session.linkWithNext(bench.id, true)
    const order = async () => (await session.loadActive())?.slots.map(({ slot }) => slot.id) ?? []

    await session.moveSlot(row.id, -1)
    expect(await order()).toEqual([row.id, bench.id, squat.id])
    await session.moveSlot(squat.id, -1)
    expect(await order()).toEqual([row.id, squat.id, bench.id])
  })
})

describe('rest', () => {
  // The built-in barbell bench press, whose default rest is 180 s.
  const BUILT_IN_BENCH = '00000000-0000-7000-8000-000000000001'

  async function workoutWithSets(exerciseId: string, count: number) {
    const workout = await session.start(ZONE)
    const slot = await session.addExercise(workout.id, exerciseId)
    for (let n = 1; n < count; n += 1) await session.addSet(slot.id)
    const sets = await db.workoutSets.where('workoutExerciseId').equals(slot.id).toArray()
    return { workout, slot, sets: sets.toSorted((a, b) => a.position - b.position) }
  }

  it("starts the exercise's default rest with the completed set, in one change", async () => {
    const { workout, sets } = await workoutWithSets(BUILT_IN_BENCH, 2)
    advance(60_000)
    const resting = await session.completeSet(sets[0]?.id ?? '')
    expect(resting).toMatchObject({
      restStartedAt: '2026-11-08T10:01:00.000Z',
      restEndsAt: '2026-11-08T10:04:00.000Z',
    })
    expect(await db.workouts.get(workout.id)).toEqual(resting)
    expect((await db.workoutSets.get(sets[0]?.id ?? ''))?.completedAt).toBe(clock.toISOString())
  })

  it("prefers the plan's rest copied to the slot, then a custom exercise's default", async () => {
    const custom = await repos.exercises.create({
      nameZh: '地雷管推举',
      nameEn: null,
      muscle: 'shoulders',
      secondaryMuscles: [],
      equipment: 'barbell',
      defaultRestS: 75,
    })
    const { slot, sets } = await workoutWithSets(custom.id, 3)
    expect((await session.completeSet(sets[0]?.id ?? '')).restEndsAt).toBe(
      '2026-11-08T10:01:15.000Z',
    )
    await repos.workoutExercises.update(slot.id, { restS: 30 })
    expect((await session.completeSet(sets[1]?.id ?? '')).restEndsAt).toBe(
      '2026-11-08T10:00:30.000Z',
    )
  })

  it('starts no rest after the last set still to do, or for a rest of 0', async () => {
    const { slot, sets } = await workoutWithSets(BUILT_IN_BENCH, 2)
    await session.completeSet(sets[0]?.id ?? '')
    const done = await session.completeSet(sets[1]?.id ?? '')
    expect(done).toMatchObject({ restStartedAt: null, restEndsAt: null })

    await session.uncompleteSet(sets[1]?.id ?? '')
    await repos.workoutExercises.update(slot.id, { restS: 0 })
    await session.addSet(slot.id)
    expect(await session.completeSet(sets[1]?.id ?? '')).toMatchObject({ restEndsAt: null })
  })

  it('rests only after each full round of a superset, for its one rest', async () => {
    const BUILT_IN_SQUAT = '00000000-0000-7000-8000-000000000002'
    const { workout, slot: a1 } = await workoutWithSets(BUILT_IN_BENCH, 3)
    const a2 = await session.addExercise(workout.id, BUILT_IN_SQUAT)
    await session.addSet(a2.id)
    await session.addSet(a2.id)
    await repos.workoutExercises.update(a2.id, { restS: 120 })
    await session.linkWithNext(a1.id, true)
    const state = await session.loadActive()
    expect(state?.slots.map(({ slot }) => slot.supersetGroup)).toEqual([0, 0])
    // The bench's default 180 s is longer than the squat's 120 s.
    expect(state?.slots.map(({ slot }) => slot.restS)).toEqual([180, 180])
    const [first, second] = state?.slots ?? []
    const rests: (string | null)[] = []
    for (let round = 0; round < 3; round += 1) {
      for (const member of [first, second]) {
        advance(60_000)
        const set = member?.sets[round]
        rests.push((await session.completeSet(set?.id ?? '')).restEndsAt)
      }
    }
    expect(rests).toEqual([
      null,
      '2026-11-08T10:05:00.000Z',
      null,
      '2026-11-08T10:07:00.000Z',
      null,
      null,
    ])

    await session.linkWithNext(a1.id, false)
    const split = await session.loadActive()
    expect(split?.slots.map(({ slot }) => slot.supersetGroup)).toEqual([null, null])
  })

  it('keeps a superset’s members at the same number of sets, and one rest', async () => {
    const BUILT_IN_SQUAT = '00000000-0000-7000-8000-000000000002'
    const { workout, slot: a1 } = await workoutWithSets(BUILT_IN_BENCH, 3)
    const a2 = await session.addExercise(workout.id, BUILT_IN_SQUAT)
    const counts = async () =>
      (await session.loadActive())?.slots.map(({ sets }) => sets.length) ?? []

    await session.linkWithNext(a1.id, true)
    expect(await counts()).toEqual([3, 3])
    const round = await session.addSet(a2.id)
    expect(round.workoutExerciseId).toBe(a1.id)
    expect(await counts()).toEqual([4, 4])

    await session.setSupersetRest(a2.id, 75)
    const rests = (await session.loadActive())?.slots.map(({ slot }) => slot.restS)
    expect(rests).toEqual([75, 75])
  })

  it('cancels the rest when the set is marked not done', async () => {
    const { sets } = await workoutWithSets(BUILT_IN_BENCH, 2)
    await session.completeSet(sets[0]?.id ?? '')
    const undone = await session.uncompleteSet(sets[0]?.id ?? '')
    expect(undone).toMatchObject({ restStartedAt: null, restEndsAt: null })
    expect((await db.workoutSets.get(sets[0]?.id ?? ''))?.completedAt).toBeNull()
  })

  it('moves the end in steps, never before now, and ends on request or finish', async () => {
    const { workout, sets } = await workoutWithSets(BUILT_IN_BENCH, 2)
    await session.completeSet(sets[0]?.id ?? '')
    expect((await session.adjustRest(workout.id, 15)).restEndsAt).toBe('2026-11-08T10:03:15.000Z')
    advance(60_000)
    expect((await session.adjustRest(workout.id, -600)).restEndsAt).toBe(clock.toISOString())
    expect(await session.endRest(workout.id)).toMatchObject({ restEndsAt: null })
    // Nothing to move once the rest has ended.
    expect((await session.adjustRest(workout.id, 15)).restEndsAt).toBeNull()

    await session.completeSet(sets[0]?.id ?? '')
    expect(await session.finish(workout.id)).toMatchObject({ restStartedAt: null })
  })
})
