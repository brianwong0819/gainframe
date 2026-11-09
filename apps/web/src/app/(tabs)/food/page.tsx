'use client'

import { useTranslations } from 'next-intl'

import { TabScreen } from '../tab-screen'

export default function FoodPage() {
  const t = useTranslations('food')
  return (
    <TabScreen title={t('title')}>
      <p className="text-body text-ink-2">{t('empty')}</p>
    </TabScreen>
  )
}
