'use client'

import type { Exercise } from '@gainframe/shared'

import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'

const customExercises = () =>
  db.exercises.filter((exercise) => exercise.deletedAt === null).toArray()

// The user's exercises, kept current as they change; undefined while loading.
export function useCustomExercises(): Exercise[] | undefined {
  return useLiveQuery(customExercises)
}
