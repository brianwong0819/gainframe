import type { Profile } from '@gainframe/shared'

import type { Repositories } from './repositories'
import type { GainframeDb } from './schema'

/**
 * The user's profile: the most recently updated live row. Two devices that set
 * targets before their first sync each create one; once both are synced every
 * device reads the same row, and the next change goes to it.
 */
export async function currentProfile(db: GainframeDb): Promise<Profile | undefined> {
  const live = await db.profiles.filter((profile) => profile.deletedAt === null).toArray()
  return live.reduce<Profile | undefined>(
    (latest, profile) =>
      latest === undefined || profile.updatedAt > latest.updatedAt ? profile : latest,
    undefined,
  )
}

export interface DailyTargets {
  proteinG: number
  kcal: number
}

/** Saves both daily targets on the current profile, creating it the first time. */
export async function saveTargets(
  db: GainframeDb,
  repos: Repositories,
  { proteinG, kcal }: DailyTargets,
): Promise<Profile> {
  return db.transaction('rw', db.profiles, db.outbox, async () => {
    const profile = await currentProfile(db)
    const values = { proteinMode: 'fixed' as const, proteinValue: proteinG, kcalTarget: kcal }
    return profile === undefined
      ? repos.profiles.create(values)
      : repos.profiles.update(profile.id, values)
  })
}
