'use client'

import { useTranslations } from 'next-intl'

import { Chevron } from '@/ui/chevron'
import { PressableLink } from '@/ui/pressable'

// The row under Today's weight card that opens the Progress page.
export function ProgressRow() {
  const t = useTranslations('progress')
  return (
    <PressableLink
      href="/progress"
      className="flex items-center justify-between gap-12 rounded-group bg-surface px-16 py-12"
    >
      <span className="flex flex-col">
        <span className="text-body font-semibold">{t('title')}</span>
        <span className="text-label text-ink-2">{t('rowHint')}</span>
      </span>
      <span className="text-ink-3">
        <Chevron direction="right" />
      </span>
    </PressableLink>
  )
}
