'use client'

import { addDays, type LocalDate, type Phase } from '@gainframe/shared'
import { useCallback } from 'react'

import { db } from '@/db/client'
import { type DayIntake, intakeByDay } from '@/db/food'
import { currentProfile } from '@/db/profile'
import { useLiveQuery } from '@/db/use-live-query'

export interface Intake {
  // The `days` days before today, oldest first; today is left out because it
  // is not over.
  days: DayIntake[]
  // Null until the daily targets are set.
  targets: { proteinG: number; kcal: number } | null
  phase: Phase | null
}

// The food log's daily totals for the protein charts, kept current; undefined
// while loading.
export function useIntake(today: LocalDate, days: number): Intake | undefined {
  const read = useCallback(async (): Promise<Intake> => {
    const [profile, intake] = await Promise.all([
      currentProfile(db),
      intakeByDay(db, addDays(today, -days), addDays(today, -1)),
    ])
    return {
      days: intake,
      targets:
        profile === undefined ? null : { proteinG: profile.proteinValue, kcal: profile.kcalTarget },
      phase: profile?.phase ?? null,
    }
  }, [today, days])
  return useLiveQuery(read)
}
