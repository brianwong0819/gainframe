'use client'

import { useTranslations } from 'next-intl'
import { useSyncExternalStore } from 'react'

import { workoutSession } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { Pressable } from '@/ui/pressable'

import { appUpdate } from './update'

const notWaiting = () => false
const loadInWorkout = async () => (await workoutSession.findActive()) !== undefined

// "A new version is ready", on Today. Updating reloads the page, so the prompt
// stays hidden while a workout is in progress; it reappears once it is finished.
export function UpdatePrompt() {
  const t = useTranslations('update')
  const waiting = useSyncExternalStore(appUpdate.subscribe, appUpdate.isWaiting, notWaiting)
  const inWorkout = useLiveQuery(loadInWorkout)
  if (!waiting || inWorkout !== false) return null
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-12 rounded-group bg-surface p-16"
    >
      <span className="flex flex-col">
        <span className="text-body text-ink">{t('title')}</span>
        <span className="text-label text-ink-3">{t('hint')}</span>
      </span>
      <Pressable
        onClick={() => {
          appUpdate.apply(navigator.serviceWorker, () => {
            window.location.reload()
          })
        }}
        className="shrink-0 rounded-ctl bg-accent px-16 py-12 text-label font-semibold text-accent-ink"
      >
        {t('apply')}
      </Pressable>
    </div>
  )
}
