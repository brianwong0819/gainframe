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

// What the account holds once the first backup ends, and how far it has got: a
// row carries `userId` once the account has it (db/sync.ts). `workouts` counts
// every finished workout on the device, `backedUpWorkouts` those in the account.
export async function countAccountRecords(db: GainframeDb) {
  return db.transaction('r', db.workouts, db.plans, db.exercises, async () => {
    const workouts = await db.workouts
      .filter((workout) => workout.deletedAt === null && workout.endedAt !== null)
      .toArray()
    return {
      workouts: workouts.length,
      backedUpWorkouts: workouts.filter((workout) => workout.userId !== null).length,
      plans: await db.plans
        .filter((plan) => plan.deletedAt === null && plan.userId !== null)
        .count(),
      exercises: await db.exercises
        .filter((exercise) => exercise.deletedAt === null && exercise.userId !== null)
        .count(),
    }
  })
}
