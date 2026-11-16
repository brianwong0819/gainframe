'use client'

import { bestSets, type WorkoutSet } from '@gainframe/shared'

import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'

const loadBestSets = async () =>
  bestSets(
    await db.workoutSets
      .filter((set) => set.deletedAt === null && set.completedAt !== null)
      .toArray(),
  )

// The user's best set of each exercise they have done, by exercise id, kept
// current as sets change; undefined while loading.
export function useBestSets(): Map<string, WorkoutSet> | undefined {
  return useLiveQuery(loadBestSets)
}
