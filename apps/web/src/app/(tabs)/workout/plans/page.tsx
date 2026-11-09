'use client'

import { useTranslations } from 'next-intl'

import { PlanList } from '@/features/plans/plan-list'
import { BackLink } from '@/ui/back-link'

export default function PlansPage() {
  const t = useTranslations('plans')
  const tWorkout = useTranslations('workout')
  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <BackLink href="/workout" label={tWorkout('title')} />
        <h1 className="text-title">{t('title')}</h1>
      </header>
      <PlanList />
    </main>
  )
}
