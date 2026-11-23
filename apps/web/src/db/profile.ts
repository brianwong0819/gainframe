import {
  type ActivityLevel,
  type BodyMetric,
  type Phase,
  type Profile,
  type Sex,
  toLocalDate,
} from '@gainframe/shared'

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

// A profile made by the targets sheet before the calculator has been used.
const NO_BODY = {
  sex: null,
  birthYear: null,
  heightCm: null,
  activityLevel: null,
  phase: null,
} as const

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
      ? repos.profiles.create({ ...values, ...NO_BODY })
      : repos.profiles.update(profile.id, values)
  })
}

/** The latest live weigh-in, or undefined before the first. */
export async function latestBodyMetric(db: GainframeDb): Promise<BodyMetric | undefined> {
  const live = await db.bodyMetrics.filter((metric) => metric.deletedAt === null).toArray()
  return live.reduce<BodyMetric | undefined>(
    (latest, metric) =>
      latest === undefined || metric.measuredAt > latest.measuredAt ? metric : latest,
    undefined,
  )
}

export interface CalculatorAnswers {
  sex: Sex
  birthYear: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  phase: Phase
}

/**
 * Saves the calculator's answers and the targets it suggested in one
 * transaction: the profile's body fields and targets, and the weight as a
 * weigh-in (M4-02 starts its trend from it). A weight equal to the latest
 * weigh-in of the same day is not stored twice.
 */
export async function applyEstimate(
  db: GainframeDb,
  repos: Repositories,
  values: {
    answers: CalculatorAnswers
    targets: DailyTargets
    measuredAt: string
    timeZone: string
  },
): Promise<void> {
  const { weightKg, ...body } = values.answers
  await db.transaction('rw', db.profiles, db.bodyMetrics, db.outbox, async () => {
    const profile = await currentProfile(db)
    const fields = {
      ...body,
      proteinMode: 'fixed' as const,
      proteinValue: values.targets.proteinG,
      kcalTarget: values.targets.kcal,
    }
    if (profile === undefined) await repos.profiles.create(fields)
    else await repos.profiles.update(profile.id, fields)

    const localDate = toLocalDate(values.measuredAt, values.timeZone)
    const latest = await latestBodyMetric(db)
    if (latest?.localDate === localDate && latest.weightKg === weightKg) return
    await repos.bodyMetrics.create({
      measuredAt: values.measuredAt,
      localDate,
      weightKg,
      bodyFatPct: null,
      skeletalMuscleKg: null,
      fatMassKg: null,
      source: 'manual',
    })
  })
}
