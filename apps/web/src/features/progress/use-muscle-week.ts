'use client'

import {
  addDays,
  BUILT_IN_EXERCISES,
  domainConfig,
  type Exercise,
  type LocalDate,
  type MuscleGroup,
  type MuscleVolume,
  muscleVolume,
  toLocalDate,
  type TrainedMuscle,
  trainedDirectly,
} from '@gainframe/shared'
import { useState } from 'react'

import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'

const readMuscleData = async () => {
  const [workouts, sets, custom] = await Promise.all([
    db.workouts.filter((workout) => workout.deletedAt === null).toArray(),
    db.workoutSets
      .filter((set) => set.deletedAt === null && set.completedAt !== null && set.kind !== 'warmup')
      .toArray(),
    db.exercises.toArray(),
  ])
  return { workouts, sets, custom }
}

export interface MuscleWeek {
  from: LocalDate
  to: LocalDate
  volume: Record<TrainedMuscle, MuscleVolume>
  // Groups trained as a primary muscle in the last four weeks.
  direct: Set<TrainedMuscle>
  // Completed sets other than warm-ups in the range.
  setsDone: number
  // Whether any set was ever completed, for the first-days state.
  everTrained: boolean
  // The user's own exercises, deleted ones included, for naming contributions.
  custom: Exercise[]
}

/**
 * Sets per muscle group over the last seven days, today included ("Muscle
 * map" in docs/design-system.md), kept current as sets change; undefined
 * while loading.
 */
export function useMuscleWeek(): MuscleWeek | undefined {
  const [today] = useState<LocalDate>(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const data = useLiveQuery(readMuscleData)
  if (data === undefined) return undefined

  const muscles = new Map<
    string,
    { muscle: MuscleGroup; secondaryMuscles: readonly MuscleGroup[] }
  >()
  for (const { id, muscle, secondaryMuscles } of [...BUILT_IN_EXERCISES, ...data.custom]) {
    muscles.set(id, { muscle, secondaryMuscles })
  }
  const { days, directDays } = domainConfig.muscleVolume
  const from = addDays(today, 1 - days)
  const volume = muscleVolume({ ...data, muscles, from, to: today })
  const recent = muscleVolume({ ...data, muscles, from: addDays(today, 1 - directDays), to: today })
  const inRange = new Set(
    data.workouts
      .filter(({ localDate }) => localDate >= from && localDate <= today)
      .map(({ id }) => id),
  )
  return {
    from,
    to: today,
    volume,
    direct: trainedDirectly(recent),
    setsDone: data.sets.filter(({ workoutId }) => inRange.has(workoutId)).length,
    everTrained: data.sets.length > 0,
    custom: data.custom,
  }
}
