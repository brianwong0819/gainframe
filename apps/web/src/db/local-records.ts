import type { GainframeDb } from './schema'

// What exists on this device, for the sign-in page's "only on this phone" card.
export async function countLocalRecords(db: GainframeDb) {
  return db.transaction('r', db.workouts, db.plans, async () => ({
    workouts: await db.workouts
      .filter((workout) => workout.deletedAt === null && workout.endedAt !== null)
      .count(),
    plans: await db.plans.filter((plan) => plan.deletedAt === null).count(),
  }))
}
