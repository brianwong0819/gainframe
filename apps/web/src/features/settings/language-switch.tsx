'use client'

import { useLocale, useTranslations } from 'next-intl'

import { LOCALES } from '@/i18n/locale'
import { chooseLocale } from '@/i18n/locale-store'
import { SegmentedControl } from '@/ui/segmented-control'

// The language setting, in Settings.
export function LanguageSwitch() {
  const t = useTranslations('language')
  const locale = useLocale()
  return (
    <SegmentedControl
      label={t('label')}
      options={LOCALES}
      value={locale}
      onChange={chooseLocale}
      optionLabel={(option) => t(option)}
      optionLang={(option) => (option === 'zh' ? 'zh-Hans' : 'en')}
    />
  )
}
