import {
  domainConfig,
  nextPlanDay,
  type Plan,
  type PlanDay,
  type PlanItem,
  planItemsFromWorkout,
} from '@gainframe/shared'

import type { Repositories } from './repositories'
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
// Which plan is active is a device setting (`DeviceSetting`), so it is read and
// written here, not through the synced repositories. The reads run inside
// `useLiveQuery`, which only sees the tables a query reads while Dexie can track
// its async context: they call Dexie directly and never await another async
// helper first, which lost that context and left the editor stale (L-026).
export function createPlanStore(db: GainframeDb, repos: Repositories) {
  async function activePlan(): Promise<Plan | undefined> {
    const setting = await db.settings.get('activePlanId')
    const plan = setting && (await db.plans.get(setting.value))
    return plan?.deletedAt === null ? plan : undefined
  }

  return {
    // Undefined when no plan is active or the active plan has been deleted.
    activePlan,

    // Makes a plan the active one; null leaves no plan active.
    async setActivePlan(planId: string | null): Promise<void> {
      if (planId === null) {
        await db.settings.delete('activePlanId')
        return
      }
      if ((await repos.plans.get(planId)) === undefined) throw new Error(`No plan ${planId}`)
      await db.settings.put({ key: 'activePlanId', value: planId })
    },

    // Every plan, oldest first.
    async list(): Promise<PlanSummary[]> {
      const plans = await db.plans.filter(live).toArray()
      const days = await db.planDays.filter(live).toArray()
      const setting = await db.settings.get('activePlanId')
      return plans
        .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((plan) => ({
          plan,
          active: plan.id === setting?.value,
          days: days.filter((day) => day.planId === plan.id).toSorted(byPosition),
        }))
    },

    // Null when the plan does not exist or has been deleted.
    async load(planId: string): Promise<PlanState | null> {
      const plan = await db.plans.get(planId)
      const days = await db.planDays.where('planId').equals(planId).filter(live).toArray()
      const items = await db.planItems.where('planId').equals(planId).filter(live).toArray()
      const setting = await db.settings.get('activePlanId')
      if (plan?.deletedAt !== null) return null
      return {
        plan,
        active: setting?.value === planId,
        days: days.toSorted(byPosition).map((day) => ({
          day,
          items: items.filter((item) => item.planDayId === day.id).toSorted(byPosition),
        })),
      }
    },

    // A new plan with its first day. The first plan a user makes becomes active.
    async create(name: string, firstDayName: string): Promise<Plan> {
      const tables = [db.plans, db.planDays, db.outbox, db.settings]
      return db.transaction('rw', tables, async () => {
        const plan = await repos.plans.create({ name })
        await repos.planDays.create({ planId: plan.id, name: firstDayName, position: 0 })
        if ((await activePlan()) === undefined) {
          await db.settings.put({ key: 'activePlanId', value: plan.id })
        }
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
        })
      })
    },

    // Saves a finished workout as a new last day of the active plan, or of a
    // new plan (which becomes active) when there is none (`planItemsFromWorkout`).
    // `dayName` gets the day's number in the rotation.
    async saveWorkoutAsDay(
      workoutId: string,
      names: { plan: string; day: (n: number) => string },
    ): Promise<PlanDay> {
      const tables = [db.plans, db.planDays, db.planItems, db.outbox, db.settings]
      const reads = [db.workoutExercises, db.workoutSets]
      return db.transaction('rw', [...tables, ...reads], async () => {
        const slots = await db.workoutExercises.where('workoutId').equals(workoutId).toArray()
        const sets = await db.workoutSets.where('workoutId').equals(workoutId).toArray()
        let plan = await activePlan()
        if (plan === undefined) {
          plan = await repos.plans.create({ name: names.plan })
          await db.settings.put({ key: 'activePlanId', value: plan.id })
        }
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
      const setting = await db.settings.get('activePlanId')
      const plan = setting && (await db.plans.get(setting.value))
      if (plan?.deletedAt !== null) return null
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
