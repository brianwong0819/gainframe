'use client'

import { useMemo } from 'react'

import { planStore } from '@/db/client'
import type { PlanState, PlanSummary } from '@/db/plans'
import { useLiveQuery } from '@/db/use-live-query'

const listPlans = () => planStore.list()

// Every plan; undefined while loading.
export function usePlans(): PlanSummary[] | undefined {
  return useLiveQuery(listPlans)
}

// One plan with its days and items; null when it does not exist, undefined
// while loading or while its ID is not known yet.
export function usePlan(planId: string | null | undefined): PlanState | null | undefined {
  const query = useMemo(
    () => () =>
      planId === null || planId === undefined ? Promise.resolve(null) : planStore.load(planId),
    [planId],
  )
  const state = useLiveQuery(query)
  return planId === undefined ? undefined : state
}
