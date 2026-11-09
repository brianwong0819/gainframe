'use client'

import { BUILT_IN_EXERCISES } from '@gainframe/shared'
import { useTranslations } from 'next-intl'

import { workoutSession } from '@/db/client'
import { ActiveWorkout, useActiveWorkout } from '@/features/workout/active-workout'
import { Chevron } from '@/ui/chevron'
import { Pressable, PressableLink } from '@/ui/pressable'

import { TabScreen } from '../tab-screen'

function startWorkout() {
  void workoutSession.start(Intl.DateTimeFormat().resolvedOptions().timeZone)
}

export default function WorkoutPage() {
  const t = useTranslations('workout')
  const active = useActiveWorkout()
  if (active) {
    return (
      <TabScreen title={t('active')}>
        <ActiveWorkout state={active} />
      </TabScreen>
    )
  }
  return (
    <TabScreen title={t('title')}>
      {active === null && (
        <Pressable
          onClick={startWorkout}
          className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
        >
          {t('start')}
        </Pressable>
      )}
      <PressableLink
        href="/workout/exercises"
        className="flex items-center justify-between gap-12 rounded-group bg-surface p-16"
      >
        <span className="flex flex-col">
          <span className="text-body text-ink">{t('library')}</span>
          <span className="text-label text-ink-3">
            {t('libraryCount', { count: BUILT_IN_EXERCISES.length })}
          </span>
        </span>
        <span className="text-ink-3">
          <Chevron direction="right" />
        </span>
      </PressableLink>
    </TabScreen>
  )
}
