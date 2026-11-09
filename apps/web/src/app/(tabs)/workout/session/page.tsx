'use client'

import { useTranslations } from 'next-intl'

import { ActiveWorkout, useActiveWorkout } from '@/features/workout/active-workout'
import { BackLink } from '@/ui/back-link'

// The workout in progress, below the Workout tab. Leaving keeps it in progress;
// the Workout tab then offers to continue it.
export default function WorkoutSessionPage() {
  const t = useTranslations('workout')
  const active = useActiveWorkout()
  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <BackLink href="/workout" label={t('title')} />
        <h1 className="text-title">{t('active')}</h1>
      </header>
      {active && <ActiveWorkout state={active} />}
      {active === null && <p className="text-body text-ink-2">{t('noneActive')}</p>}
    </main>
  )
}
