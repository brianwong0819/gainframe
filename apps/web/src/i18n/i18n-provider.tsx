'use client'

import { NextIntlClientProvider } from 'next-intl'
import { useEffect, useSyncExternalStore, type ReactNode } from 'react'

import en from '../../messages/en.json'
import zh from '../../messages/zh.json'

import { DEFAULT_LOCALE, type Locale } from './locale'
import { localeSnapshot, subscribeLocale } from './locale-store'
import { deviceTimeZone } from './time-zone'

const messages = { zh, en } satisfies Record<Locale, typeof en>

// The device's time zone for dates next-intl formats; the build renders UTC.
const noSubscription = () => () => undefined
const buildTimeZone = () => 'UTC'

/**
 * Client-only i18n for the static export: no middleware or request exists to
 * pick a language, so pages are prerendered in the default locale and switch
 * to the device's choice right after hydration (under the launch screen in
 * the installed app). Both catalogues are small and bundled.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, localeSnapshot, () => DEFAULT_LOCALE)
  const timeZone = useSyncExternalStore(noSubscription, deviceTimeZone, buildTimeZone)

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : 'en'
  }, [locale])

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  )
}
