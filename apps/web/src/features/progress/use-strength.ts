'use client'

import {
  addDays,
  type Exercise,
  type LocalDate,
  type StrengthMeasure,
  type StrengthPoint,
  strengthHistory,
  type Workout,
  type WorkoutSet,
  type WeightUnit,
} from '@gainframe/shared'

import { db, weightUnits } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'

const readStrengthData = async () => {
  const [workouts, sets, custom, units] = await Promise.all([
    db.workouts.filter((workout) => workout.deletedAt === null).toArray(),
    db.workoutSets.filter((set) => set.deletedAt === null && set.completedAt !== null).toArray(),
    db.exercises.toArray(),
    weightUnits.all(),
  ])
  return { workouts, sets, custom, units }
}

export interface StrengthData {
  workouts: Workout[]
  sets: WorkoutSet[]
  // The user's own exercises, deleted ones included, for naming.
  custom: Exercise[]
  // Exercise ID to unit, for exercises not shown in kg.
  units: Map<string, WeightUnit>
}

// Workouts, completed sets, the user's exercises and weight units for the
// strength charts, kept current; undefined while loading.
export function useStrengthData(): StrengthData | undefined {
  return useLiveQuery(readStrengthData)
}

// The strength charts cover the last twelve weeks, or every workout when fewer
// than two fall inside them, so an exercise done twice long ago still draws.
export const SPAN_DAYS = 84

export function strengthSpan(
  data: StrengthData,
  exerciseId: string,
  measure: StrengthMeasure,
  today: LocalDate,
): { all: StrengthPoint[]; points: StrengthPoint[]; from: LocalDate } {
  const all = strengthHistory({ exerciseId, workouts: data.workouts, sets: data.sets, measure })
  const start = addDays(today, 1 - SPAN_DAYS)
  const recent = all.filter(({ localDate }) => localDate >= start)
  const points = recent.length >= 2 ? recent : all
  return { all, points, from: points[0]?.localDate ?? start }
}
