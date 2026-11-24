import { type BodyMetric, toLocalDate } from '@gainframe/shared'

import type { Repositories } from './repositories'
import type { GainframeDb } from './schema'

/** Every live weigh-in, oldest first. */
export async function liveBodyMetrics(db: GainframeDb): Promise<BodyMetric[]> {
  const live = await db.bodyMetrics.filter((metric) => metric.deletedAt === null).toArray()
  return live.toSorted((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt))
}

export interface WeighIn {
  weightKg: number
  bodyFatPct: number | null
  skeletalMuscleKg: number | null
}

/**
 * Saves the day's weigh-in. A second weigh-in on the same day corrects the
 * first one instead of adding a row, so the day keeps one weight.
 */
export async function saveWeighIn(
  db: GainframeDb,
  repos: Repositories,
  values: WeighIn & { measuredAt: string; timeZone: string },
): Promise<BodyMetric> {
  const { measuredAt, timeZone, ...weighIn } = values
  const localDate = toLocalDate(measuredAt, timeZone)
  return db.transaction('rw', db.bodyMetrics, db.outbox, async () => {
    const sameDay = (await liveBodyMetrics(db)).findLast(
      (metric) => metric.localDate === localDate && metric.source === 'manual',
    )
    return sameDay === undefined
      ? repos.bodyMetrics.create({
          ...weighIn,
          measuredAt,
          localDate,
          fatMassKg: null,
          source: 'manual',
        })
      : repos.bodyMetrics.update(sameDay.id, { ...weighIn, measuredAt })
  })
}
