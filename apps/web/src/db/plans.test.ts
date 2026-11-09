import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { toLocalDate } from '@gainframe/shared'

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

  it("offers the day after the plan's latest finished workout", async () => {
    const plan = await repos.plans.create({ name: 'Push Pull Legs' })
    const [push, pull, legs] = await Promise.all(
      ['Push', 'Pull', 'Legs'].map((name, position) =>
        repos.planDays.create({ planId: plan.id, name, position }),
      ),
    )
    if (push === undefined || pull === undefined || legs === undefined) throw new Error('No days')
    expect(await plans.nextDay(plan.id)).toEqual(push)

    await finishedWorkout(push.id)
    expect(await plans.nextDay(plan.id)).toEqual(pull)
    await finishedWorkout(pull.id)
    await finishedWorkout(legs.id)
    expect(await plans.nextDay(plan.id)).toEqual(push)
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
})
