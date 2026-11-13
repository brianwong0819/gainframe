'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { planStore } from '@/db/client'
import { Chevron } from '@/ui/chevron'
import { Pressable, PressableLink } from '@/ui/pressable'

import { usePlans } from './use-plans'

// The user's plans, the active one marked. Creating a plan opens it in the
// editor; the first plan becomes the active one. The create button appears
// with the list: the prerendered page would show it before hydration, and a
// tap then does nothing.
export function PlanList() {
  const t = useTranslations('plans')
  const router = useRouter()
  const plans = usePlans()

  return (
    <>
      {plans?.length === 0 && <p className="text-body text-ink-2">{t('none')}</p>}
      {plans?.map(({ plan, active, days }) => (
        <PressableLink
          key={plan.id}
          href={`/workout/plan#${plan.id}`}
          className="flex items-center justify-between gap-12 rounded-group bg-surface p-16"
        >
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-8">
              <span className="truncate text-body font-semibold text-ink">{plan.name}</span>
              {active && (
                <span className="rounded-full bg-accent px-8 text-label text-accent-ink">
                  {t('active')}
                </span>
              )}
            </span>
            <span className="truncate text-label text-ink-3">
              {t('rotation', { count: days.length })}
              {days.length > 0 && ` · ${days.map((day) => day.name).join(' / ')}`}
            </span>
          </span>
          <span className="text-ink-3">
            <Chevron direction="right" />
          </span>
        </PressableLink>
      ))}
      {plans && (
        <Pressable
          onClick={() => {
            void planStore.create(t('newName'), t('dayName', { n: 1 })).then((plan) => {
              router.push(`/workout/plan#${plan.id}`)
            })
          }}
          className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
        >
          {t('create')}
        </Pressable>
      )}
    </>
  )
}
