'use client'

import { BUILT_IN_EXERCISES } from '@gainframe/shared'
import { useTranslations } from 'next-intl'

import { Chevron } from '@/ui/chevron'
import { PressableLink } from '@/ui/pressable'

import { TabScreen } from '../tab-screen'

export default function WorkoutPage() {
  const t = useTranslations('workout')
  return (
    <TabScreen title={t('title')}>
      <p className="text-body text-ink-2">{t('empty')}</p>
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
