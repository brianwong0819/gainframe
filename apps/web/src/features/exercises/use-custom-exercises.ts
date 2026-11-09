'use client'

import type { Exercise } from '@gainframe/shared'
import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'

import { db } from '@/db/client'

// The user's exercises, kept current as they change; undefined while loading.
// A failed read is rethrown during render, so the error screen records it.
export function useCustomExercises(): Exercise[] | undefined {
  const [exercises, setExercises] = useState<Exercise[]>()
  const [failure, setFailure] = useState<Error | null>(null)
  useEffect(() => {
    const subscription = liveQuery(() =>
      db.exercises.filter((exercise) => exercise.deletedAt === null).toArray(),
    ).subscribe({
      next: setExercises,
      error: (reason: unknown) => {
        setFailure(reason instanceof Error ? reason : new Error(String(reason)))
      },
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [])
  if (failure !== null) throw failure
  return exercises
}
