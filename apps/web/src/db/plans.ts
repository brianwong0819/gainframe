import {
  activePlanOf,
  domainConfig,
  linkWithNext,
  moveItem,
  nextPlanDay,
  type Plan,
  type PlanDay,
  type PlanItem,
  planItemsFromWorkout,
  sharedValueChanges,
  supersetMembers,
  unlinkFromNext,
} from '@gainframe/shared'

import { restResolver } from './exercise-rest'
import { nextUpdatedAt, type Repositories } from './repositories'
import type { GainframeDb } from './schema'

export interface PlanDayState {
  day: PlanDay
  items: PlanItem[]
}

// A plan as the editor shows it: its live days in rotation order, each with its
// live items in order.
export interface PlanState {
  plan: Plan
  active: boolean
  days: PlanDayState[]
}

// The active plan's next day, as the Workout tab offers it: `n` counts from 1
// in `days`, the plan's days in rotation order.
export interface UpNext {
  plan: Plan
  day: PlanDay
  n: number
  days: PlanDay[]
  items: PlanItem[]
}

// A plan as the plan list shows it.
export interface PlanSummary {
  plan: Plan
  active: boolean
  days: PlanDay[]
}

const live = (row: { deletedAt: string | null }) => row.deletedAt === null
const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position

function nextPosition(rows: readonly { position: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.position + 1), 0)
}

// Plans, their days and items, the active plan and the day it offers next.
// The active plan is the live plan with the latest `activatedAt`
// (`activePlanOf`), a synced field, so the choice survives a cleared device and
// reaches the account's other devices. The reads run inside
// `useLiveQuery`, which only sees the tables a query reads while Dexie can track
// its async context: they call Dexie directly and never await another async
// helper first, which lost that context and left the editor stale (L-026).
export function createPlanStore(
  db: GainframeDb,
  repos: Repositories,
  now: () => Date = () => new Date(),
) {
  async function activePlan(): Promise<Plan | undefined> {
    return activePlanOf(await db.plans.toArray())
  }

  // The live items of the day an item belongs to.
  async function dayItemsOf(itemId: string): Promise<PlanItem[]> {
    const item = await repos.planItems.get(itemId)
    if (item === undefined) throw new Error(`No plan item ${itemId}`)
    return db.planItems
      .where('planDayId')
      .equals(item.planDayId)
      .filter((other) => other.deletedAt === null)
      .toArray()
  }

  return {
    // Undefined when no plan is active or the active plan has been deleted.
    activePlan,

    // Makes a plan the active one. Its `activatedAt` always passes the current
    // active plan's, even when the device clock has gone back.
    async setActivePlan(planId: string): Promise<void> {
      await db.transaction('rw', db.plans, db.outbox, async () => {
        const current = await activePlan()
        const activatedAt = current?.activatedAt
        const at = activatedAt == null ? now().toISOString() : nextUpdatedAt(activatedAt, now())
        await repos.plans.update(planId, { activatedAt: at })
      })
    },

    // Every plan, oldest first.
    async list(): Promise<PlanSummary[]> {
      const plans = await db.plans.filter(live).toArray()
      const days = await db.planDays.filter(live).toArray()
      const active = activePlanOf(plans)
      return plans
        .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((plan) => ({
          plan,
          active: plan.id === active?.id,
          days: days.filter((day) => day.planId === plan.id).toSorted(byPosition),
        }))
    },

    // Null when the plan does not exist or has been deleted.
    async load(planId: string): Promise<PlanState | null> {
      const plan = await db.plans.get(planId)
      const days = await db.planDays.where('planId').equals(planId).filter(live).toArray()
      const items = await db.planItems.where('planId').equals(planId).filter(live).toArray()
      const active = activePlanOf(await db.plans.toArray())
      if (plan?.deletedAt !== null) return null
      return {
        plan,
        active: active?.id === planId,
        days: days.toSorted(byPosition).map((day) => ({
          day,
          items: items.filter((item) => item.planDayId === day.id).toSorted(byPosition),
        })),
      }
    },

    // A new plan with its first day. The first plan a user makes becomes active.
    async create(name: string, firstDayName: string): Promise<Plan> {
      return db.transaction('rw', db.plans, db.planDays, db.outbox, async () => {
        const first = (await activePlan()) === undefined
        const plan = await repos.plans.create({
          name,
          activatedAt: first ? now().toISOString() : null,
        })
        await repos.planDays.create({ planId: plan.id, name: firstDayName, position: 0 })
        return plan
      })
    },

    // Appends a day to the plan's rotation.
    async addDay(planId: string, name: string): Promise<PlanDay> {
      return db.transaction('rw', db.planDays, db.outbox, async () => {
        const days = await db.planDays.where('planId').equals(planId).toArray()
        return repos.planDays.create({ planId, name, position: nextPosition(days) })
      })
    },

    // Appends an exercise to a day with the default sets and rep range.
    async addItem(dayId: string, exerciseId: string): Promise<PlanItem> {
      return db.transaction('rw', db.planDays, db.planItems, db.outbox, async () => {
        const day = await repos.planDays.get(dayId)
        if (day === undefined) throw new Error(`No plan day ${dayId}`)
        const items = await db.planItems.where('planDayId').equals(dayId).toArray()
        return repos.planItems.create({
          planId: day.planId,
          planDayId: dayId,
          exerciseId,
          position: nextPosition(items),
          supersetGroup: null,
          ...domainConfig.newPlanItem,
          restS: null,
          note: null,
        })
      })
    },

    // Joins an exercise of a day with the one after it into a superset, or
    // splits the superset between them; a workout from the day copies the groups.
    // A new superset starts with the longest rest and the most sets of its
    // members, which keep them if they are split again.
    async linkWithNext(itemId: string, linked: boolean): Promise<void> {
      await db.transaction('rw', db.planItems, db.outbox, db.exercises, async () => {
        const items = await dayItemsOf(itemId)
        const changes = linked ? linkWithNext(items, itemId) : unlinkFromNext(items, itemId)
        for (const { id, supersetGroup } of changes) {
          await repos.planItems.update(id, { supersetGroup })
        }
        const restOf = await restResolver(db.exercises)
        const after = await dayItemsOf(itemId)
        for (const { id, value } of sharedValueChanges(after, restOf, (item) => item.restS)) {
          await repos.planItems.update(id, { restS: value })
        }
        const sets = (item: PlanItem) => item.targetSets
        for (const { id, value } of sharedValueChanges(after, sets, sets)) {
          await repos.planItems.update(id, { targetSets: value })
        }
      })
    },

    // Sets a superset's rest, taken after each round, or its number of rounds
    // on every member; on the item alone when it stands alone.
    async updateSuperset(
      itemId: string,
      changes: Partial<Pick<PlanItem, 'restS' | 'targetSets'>>,
    ): Promise<void> {
      await db.transaction('rw', db.planItems, db.outbox, async () => {
        for (const { id } of supersetMembers(await dayItemsOf(itemId), itemId)) {
          await repos.planItems.update(id, changes)
        }
      })
    },

    // Moves an exercise of a day one step up (-1) or down (1), keeping
    // supersets together (`moveItem`).
    async moveItem(itemId: string, direction: -1 | 1): Promise<void> {
      await db.transaction('rw', db.planItems, db.outbox, async () => {
        for (const { id, position } of moveItem(await dayItemsOf(itemId), itemId, direction)) {
          await repos.planItems.update(id, { position })
        }
      })
    },

    // Saves a finished workout as a new last day of the active plan, or of a
    // new plan (which becomes active) when there is none (`planItemsFromWorkout`).
    // `dayName` gets the day's number in the rotation.
    async saveWorkoutAsDay(
      workoutId: string,
      names: { plan: string; day: (n: number) => string },
    ): Promise<PlanDay> {
      const tables = [db.plans, db.planDays, db.planItems, db.outbox]
      const reads = [db.workoutExercises, db.workoutSets]
      return db.transaction('rw', [...tables, ...reads], async () => {
        const slots = await db.workoutExercises.where('workoutId').equals(workoutId).toArray()
        const sets = await db.workoutSets.where('workoutId').equals(workoutId).toArray()
        let plan = await activePlan()
        plan ??= await repos.plans.create({
          name: names.plan,
          activatedAt: now().toISOString(),
        })
        const days = await db.planDays.where('planId').equals(plan.id).toArray()
        const day = await repos.planDays.create({
          planId: plan.id,
          name: names.day(days.filter(live).length + 1),
          position: nextPosition(days),
        })
        for (const item of planItemsFromWorkout(slots, sets)) {
          await repos.planItems.create({ ...item, planId: plan.id, planDayId: day.id })
        }
        return day
      })
    },

    // What the Workout tab offers: the active plan's next day (`nextPlanDay`),
    // its place in the rotation and its exercises. Null without an active plan
    // or when the plan has no days.
    async upNext(): Promise<UpNext | null> {
      const plan = activePlanOf(await db.plans.toArray())
      if (plan === undefined) return null
      const days = await db.planDays.where('planId').equals(plan.id).toArray()
      const workouts = await db.workouts
        .where('planDayId')
        .anyOf(days.map((day) => day.id))
        .toArray()
      const items = await db.planItems.where('planId').equals(plan.id).filter(live).toArray()
      const day = nextPlanDay(days, workouts)
      if (day === undefined) return null
      const rotation = days.filter(live).toSorted(byPosition)
      return {
        plan,
        day,
        n: rotation.indexOf(day) + 1,
        days: rotation,
        items: items.filter((item) => item.planDayId === day.id).toSorted(byPosition),
      }
    },
  }
}

export type PlanStore = ReturnType<typeof createPlanStore>
