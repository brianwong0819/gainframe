'use client'

import { useMemo, useSyncExternalStore } from 'react'

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

function subscribeToHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
  }
}

// The plan the editor shows, from the URL fragment (`/workout/plan#<id>`). A
// fragment, not a query string: the exported page is one static file, and the
// service worker's precache matches the URL without its fragment, so the page
// also opens offline. Undefined on the server render, where it is not known;
// null when the URL has none.
export function usePlanIdFromHash(): string | null | undefined {
  return useSyncExternalStore(
    subscribeToHash,
    () => decodeURIComponent(window.location.hash.slice(1)) || null,
    () => undefined,
  )
}
