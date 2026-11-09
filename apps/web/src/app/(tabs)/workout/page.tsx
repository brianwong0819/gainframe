'use client'

import { useTranslations } from 'next-intl'

import { TabScreen } from '../tab-screen'

export default function WorkoutPage() {
  const t = useTranslations('workout')
  return (
    <TabScreen title={t('title')}>
      <p className="text-body text-ink-2">{t('empty')}</p>
    </TabScreen>
  )
}
