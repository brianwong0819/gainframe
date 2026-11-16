'use client'

import { useLocale, useTranslations } from 'next-intl'

import { chooseLocale } from '@/i18n/locale-store'
import { LOCALES } from '@/i18n/locale'
import { Pressable } from '@/ui/pressable'

// The language setting, in Settings.
export function LanguageSwitch() {
  const t = useTranslations('language')
  const locale = useLocale()
  return (
    <div role="group" aria-label={t('label')} className="flex gap-8">
      {LOCALES.map((option) => (
        <Pressable
          key={option}
          lang={option === 'zh' ? 'zh-Hans' : 'en'}
          aria-pressed={option === locale}
          onClick={() => {
            chooseLocale(option)
          }}
          className="rounded-ctl px-16 py-12 text-label text-ink-2 aria-pressed:bg-sunk aria-pressed:text-ink"
        >
          {t(option)}
        </Pressable>
      ))}
    </div>
  )
}
