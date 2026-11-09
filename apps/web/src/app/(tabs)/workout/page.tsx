'use client'

import { BUILT_IN_EXERCISES } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { planStore, workoutSession } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { useActiveWorkout } from '@/features/workout/active-workout'
import { Chevron } from '@/ui/chevron'
import { Pressable, PressableLink } from '@/ui/pressable'

import { TabScreen } from '../tab-screen'

const loadActivePlan = () => planStore.activePlan()

const linkCardClass = 'flex items-center justify-between gap-12 rounded-group bg-surface p-16'

export default function WorkoutPage() {
  const t = useTranslations('workout')
  const router = useRouter()
  const active = useActiveWorkout()
  const sets = active?.slots.flatMap((slot) => slot.sets) ?? []
  const done = sets.filter((set) => set.completedAt !== null).length
  const activePlan = useLiveQuery(loadActivePlan)

  return (
    <TabScreen title={t('title')}>
      {active && (
        <PressableLink href="/workout/session" className={linkCardClass}>
          <span className="flex flex-col">
            <span className="text-body font-semibold text-ink">{t('continue')}</span>
            <span className="text-label text-ink-3">
              {t('progress', { exercises: active.slots.length, done })}
            </span>
          </span>
          <span className="text-ink-3">
            <Chevron direction="right" />
          </span>
        </PressableLink>
      )}
      {active === null && (
        <Pressable
          onClick={() => {
            void workoutSession.start(Intl.DateTimeFormat().resolvedOptions().timeZone).then(() => {
              router.push('/workout/session')
            })
          }}
          className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
        >
          {t('start')}
        </Pressable>
      )}
      <PressableLink href="/workout/plans" className={linkCardClass}>
        <span className="flex min-w-0 flex-col">
          <span className="text-body text-ink">{t('plans')}</span>
          <span className="truncate text-label text-ink-3">
            {activePlan ? t('plansActive', { name: activePlan.name }) : t('plansNone')}
          </span>
        </span>
        <span className="text-ink-3">
          <Chevron direction="right" />
        </span>
      </PressableLink>
      <PressableLink href="/workout/exercises" className={linkCardClass}>
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
