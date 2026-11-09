import { nextPlanDay, type Plan, type PlanDay } from '@gainframe/shared'

import type { Repositories } from './repositories'
import type { GainframeDb } from './schema'

// The active plan and the day it offers next. Which plan is active is a device
// setting (`DeviceSetting`), so it is read and written here, not through the
// synced repositories.
export function createPlanStore(db: GainframeDb, repos: Repositories) {
  return {
    // Undefined when no plan is active or the active plan has been deleted.
    async activePlan(): Promise<Plan | undefined> {
      const setting = await db.settings.get('activePlanId')
      return setting === undefined ? undefined : repos.plans.get(setting.value)
    },

    // Makes a plan the active one; null leaves no plan active.
    async setActivePlan(planId: string | null): Promise<void> {
      if (planId === null) {
        await db.settings.delete('activePlanId')
        return
      }
      if ((await repos.plans.get(planId)) === undefined) throw new Error(`No plan ${planId}`)
      await db.settings.put({ key: 'activePlanId', value: planId })
    },

    // The day after the one the plan's latest finished workout followed
    // (`nextPlanDay`); undefined when the plan has no days.
    async nextDay(planId: string): Promise<PlanDay | undefined> {
      const days = await db.planDays.where('planId').equals(planId).toArray()
      const workouts = await db.workouts
        .where('planDayId')
        .anyOf(days.map((day) => day.id))
        .toArray()
      return nextPlanDay(days, workouts)
    },
  }
}

export type PlanStore = ReturnType<typeof createPlanStore>
