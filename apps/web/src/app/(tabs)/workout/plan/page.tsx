'use client'

import { useTranslations } from 'next-intl'

import { PlanEditor } from '@/features/plans/plan-editor'
import { usePlan, usePlanIdFromHash } from '@/features/plans/use-plans'
import { BackLink } from '@/ui/back-link'

// One plan, at /workout/plan#<id> (see usePlanIdFromHash).
export default function PlanPage() {
  const t = useTranslations('plans')
  const state = usePlan(usePlanIdFromHash())
  return (
    <main className="flex flex-col gap-20">
      <BackLink href="/workout/plans" label={t('title')} />
      {state && <PlanEditor state={state} />}
      {state === null && <p className="text-body text-ink-2">{t('missing')}</p>}
    </main>
  )
}
