import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { toLocalDate } from '@gainframe/shared'

import { createWorkoutSession } from './workout-session'
import { createPlanStore, type PlanStore } from './plans'
import { createRepositories, type Repositories } from './repositories'
import { GainframeDb } from './schema'

const BENCH = '00000000-0000-7000-8000-000000000001'
const SQUAT = '00000000-0000-7000-8000-000000000002'

let db: GainframeDb
let repos: Repositories
let plans: PlanStore
let clock: Date

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  clock = new Date('2026-11-09T10:00:00.000Z')
  repos = createRepositories(db, () => clock)
  plans = createPlanStore(db, repos)
})

afterEach(() => {
  db.close()
})

async function finishedWorkout(planDayId: string) {
  const startedAt = clock.toISOString()
  clock = new Date(clock.getTime() + 86_400_000)
  return repos.workouts.create({
    startedAt,
    endedAt: new Date(Date.parse(startedAt) + 3_600_000).toISOString(),
    planDayId,
    localDate: toLocalDate(startedAt, 'Asia/Kuala_Lumpur'),
    note: null,
    restStartedAt: null,
    restEndsAt: null,
  })
}

describe('plan store', () => {
  it('keeps one active plan and switches it', async () => {
    const ppl = await repos.plans.create({ name: 'Push Pull Legs' })
    const upperLower = await repos.plans.create({ name: 'Upper Lower' })
    expect(await plans.activePlan()).toBeUndefined()

    await plans.setActivePlan(ppl.id)
    expect(await plans.activePlan()).toEqual(ppl)
    await plans.setActivePlan(upperLower.id)
    expect(await plans.activePlan()).toEqual(upperLower)
    await plans.setActivePlan(null)
    expect(await plans.activePlan()).toBeUndefined()
  })

  it('has no active plan once the active plan is deleted', async () => {
    const plan = await repos.plans.create({ name: 'Push Pull Legs' })
    await plans.setActivePlan(plan.id)
    await repos.plans.remove(plan.id)
    expect(await plans.activePlan()).toBeUndefined()
    await expect(plans.setActivePlan(plan.id)).rejects.toThrow()
  })

  it('does not sync which plan is active', async () => {
    const plan = await repos.plans.create({ name: 'Push Pull Legs' })
    const outbox = await db.outbox.count()
    await plans.setActivePlan(plan.id)
    expect(await db.outbox.count()).toBe(outbox)
  })

  it("offers the active plan's day after its latest finished workout", async () => {
    expect(await plans.upNext()).toBeNull()
    const plan = await plans.create('Push Pull Legs', 'Push')
    const pull = await plans.addDay(plan.id, 'Pull')
    const legs = await plans.addDay(plan.id, 'Legs')
    const row = await plans.addItem(pull.id, BENCH)
    const push = (await plans.upNext())?.day
    if (push === undefined) throw new Error('No first day')
    expect(await plans.upNext()).toMatchObject({ plan, day: push, n: 1, items: [] })

    await finishedWorkout(push.id)
    expect(await plans.upNext()).toMatchObject({ day: pull, n: 2, items: [row] })
    expect((await plans.upNext())?.days.map((day) => day.name)).toEqual(['Push', 'Pull', 'Legs'])
    await finishedWorkout(pull.id)
    await finishedWorkout(legs.id)
    expect((await plans.upNext())?.day).toEqual(push)
  })

  it('offers nothing for a plan without days', async () => {
    const plan = await plans.create('Push Pull Legs', 'Push')
    const day = (await plans.load(plan.id))?.days[0]?.day
    await repos.planDays.remove(day?.id ?? '')
    expect(await plans.upNext()).toBeNull()
  })

  it('makes the first plan active with its first day, and not later ones', async () => {
    const first = await plans.create('Push Pull Legs', 'Day 1')
    clock = new Date(clock.getTime() + 1000)
    const second = await plans.create('Upper Lower', 'Day 1')
    const summaries = await plans.list()
    expect(summaries.map(({ plan, active }) => [plan.id, active])).toEqual([
      [first.id, true],
      [second.id, false],
    ])
    expect(summaries[0]?.days.map((day) => [day.name, day.position])).toEqual([['Day 1', 0]])
  })

  it('appends days and items in order, with the default sets and rep range', async () => {
    const plan = await plans.create('Push Pull Legs', 'Push')
    const pull = await plans.addDay(plan.id, 'Pull')
    const row = await plans.addItem(pull.id, BENCH)
    const second = await plans.addItem(pull.id, SQUAT)
    expect(row).toMatchObject({
      planId: plan.id,
      position: 0,
      targetSets: 3,
      repsMin: 8,
      repsMax: 12,
      restS: null,
    })
    expect(second.position).toBe(1)

    const state = await plans.load(plan.id)
    expect(state?.active).toBe(true)
    expect(state?.days.map(({ day }) => day.name)).toEqual(['Push', 'Pull'])
    expect(state?.days[1]?.items.map((item) => item.exerciseId)).toEqual([BENCH, SQUAT])
  })

  it('links items into a superset that a workout from the day copies', async () => {
    const plan = await plans.create('Upper Lower', 'Upper')
    const day = (await plans.load(plan.id))?.days[0]?.day
    const bench = await plans.addItem(day?.id ?? '', BENCH)
    await plans.addItem(day?.id ?? '', SQUAT)
    await plans.linkWithNext(bench.id, true)
    const groups = async () =>
      (await plans.load(plan.id))?.days[0]?.items.map((item) => item.supersetGroup)
    expect(await groups()).toEqual([0, 0])

    const session = createWorkoutSession(db, repos, () => clock)
    await session.startFromPlanDay(day?.id ?? '', 'Asia/Kuala_Lumpur')
    const active = await session.loadActive()
    expect(active?.slots.map(({ slot }) => slot.supersetGroup)).toEqual([0, 0])

    await plans.linkWithNext(bench.id, false)
    expect(await groups()).toEqual([null, null])
  })

  it('gives a new superset one rest and one number of rounds, and changes them together', async () => {
    const plan = await plans.create('Full body', 'A')
    const day = (await plans.load(plan.id))?.days[0]?.day
    const bench = await plans.addItem(day?.id ?? '', BENCH)
    const squat = await plans.addItem(day?.id ?? '', SQUAT)
    await repos.planItems.update(bench.id, { restS: 60, targetSets: 5 })
    await repos.planItems.update(squat.id, { restS: 90 })
    const values = async () =>
      (await plans.load(plan.id))?.days[0]?.items.map(({ restS, targetSets }) => [
        restS,
        targetSets,
      ])

    await plans.linkWithNext(bench.id, true)
    expect(await values()).toEqual([
      [90, 5],
      [90, 5],
    ])
    await plans.updateSuperset(squat.id, { restS: 120, targetSets: 4 })
    expect(await values()).toEqual([
      [120, 4],
      [120, 4],
    ])
    await plans.linkWithNext(bench.id, false)
    await plans.updateSuperset(squat.id, { restS: 45 })
    expect(await values()).toEqual([
      [120, 4],
      [45, 4],
    ])
  })

  it('moves an exercise within its day', async () => {
    const plan = await plans.create('Full body', 'A')
    const day = (await plans.load(plan.id))?.days[0]?.day
    const bench = await plans.addItem(day?.id ?? '', BENCH)
    await plans.addItem(day?.id ?? '', SQUAT)
    await plans.moveItem(bench.id, 1)
    const items = (await plans.load(plan.id))?.days[0]?.items
    expect(items?.map((item) => item.exerciseId)).toEqual([SQUAT, BENCH])
  })

  it('leaves deleted days and items out, and loads a deleted plan as null', async () => {
    const plan = await plans.create('Push Pull Legs', 'Push')
    const pull = await plans.addDay(plan.id, 'Pull')
    const row = await plans.addItem(pull.id, BENCH)
    await plans.addItem(pull.id, SQUAT)
    await repos.planItems.remove(row.id)
    const push = (await plans.load(plan.id))?.days[0]?.day
    if (push === undefined) throw new Error('No first day')
    await repos.planDays.remove(push.id)

    const state = await plans.load(plan.id)
    expect(state?.days.map(({ day }) => day.name)).toEqual(['Pull'])
    expect(state?.days[0]?.items.map((item) => item.exerciseId)).toEqual([SQUAT])

    await repos.plans.remove(plan.id)
    expect(await plans.load(plan.id)).toBeNull()
    expect(await plans.list()).toEqual([])
  })

  it('saves a finished workout as the last day of the active plan', async () => {
    const workout = await finishedWorkout('01960000-0000-7000-8000-0000000000d9')
    const slot = await repos.workoutExercises.create({
      workoutId: workout.id,
      exerciseId: BENCH,
      position: 0,
      supersetGroup: null,
      note: null,
      repsMin: null,
      repsMax: null,
      restS: null,
      planNote: null,
    })
    for (const reps of [10, 8]) {
      await repos.workoutSets.create({
        workoutExerciseId: slot.id,
        workoutId: workout.id,
        exerciseId: BENCH,
        position: reps,
        kind: 'working',
        weightKg: 60,
        reps,
        rpe: null,
        completedAt: workout.startedAt,
      })
    }
    const names = { plan: 'My plan', day: (n: number) => `Day ${String(n)}` }

    // Without an active plan, a new one is made and becomes active.
    const first = await plans.saveWorkoutAsDay(workout.id, names)
    const plan = await plans.activePlan()
    expect(plan?.name).toBe('My plan')
    expect(first).toMatchObject({ planId: plan?.id, name: 'Day 1', position: 0 })

    const second = await plans.saveWorkoutAsDay(workout.id, names)
    expect(second).toMatchObject({ planId: plan?.id, name: 'Day 2', position: 1 })
    const state = await plans.load(plan?.id ?? '')
    expect(state?.days[1]?.items).toMatchObject([
      { exerciseId: BENCH, targetSets: 2, repsMin: 8, repsMax: 10, restS: null },
    ])
  })
})
