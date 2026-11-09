'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { planStore } from '@/db/client'
import { Pressable } from '@/ui/pressable'

import { usePlans } from './use-plans'

// "Add to plan" in the exercise detail: the days of every plan, the current
// plan first; a tap appends the exercise to that day.
export function AddToPlan({ exerciseId }: { exerciseId: string }) {
  const t = useTranslations('plans')
  const plans = usePlans()
  const [showing, setShowing] = useState(false)
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set())
  const days = (plans ?? [])
    .toSorted((a, b) => Number(b.active) - Number(a.active))
    .flatMap(({ plan, days }) => days.map((day) => ({ plan, day })))

  if (!showing) {
    return (
      <Pressable
        onClick={() => {
          setShowing(true)
        }}
        className="rounded-full bg-sunk px-20 py-16 font-semibold text-ink"
      >
        {t('addToPlan')}
      </Pressable>
    )
  }
  return (
    <section className="flex flex-col gap-8" aria-label={t('addToPlan')}>
      <h3 className="text-label text-ink-3">{t('addToPlan')}</h3>
      {days.length === 0 && <p className="text-body text-ink-2">{t('noPlansToAdd')}</p>}
      <ul>
        {days.map(({ plan, day }) => {
          const done = added.has(day.id)
          return (
            <li key={day.id} className="border-t border-line first:border-t-0">
              <Pressable
                disabled={done}
                onClick={() => {
                  void planStore.addItem(day.id, exerciseId).then(() => {
                    setAdded((current) => new Set([...current, day.id]))
                  })
                }}
                className="flex w-full items-center justify-between gap-12 py-12 text-left"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-body text-ink">{day.name}</span>
                  <span className="truncate text-label text-ink-3">{plan.name}</span>
                </span>
                <span className="shrink-0 text-label text-ink-2">
                  {done ? t('added') : t('add')}
                </span>
              </Pressable>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
