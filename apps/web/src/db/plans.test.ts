import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { toLocalDate } from '@gainframe/shared'

import { createPlanStore, type PlanStore } from './plans'
import { createRepositories, type Repositories } from './repositories'
import { GainframeDb } from './schema'

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
})
