'use client'

import { useSyncExternalStore } from 'react'

import en from '../../messages/en.json'
import zh from '../../messages/zh.json'

import { ErrorScreen } from '@/diagnostics/error-screen'
import { DEFAULT_LOCALE } from '@/i18n/locale'
import { localeSnapshot } from '@/i18n/locale-store'

import '@/styles/globals.css'

const noSubscription = () => () => undefined
const buildLocale = () => DEFAULT_LOCALE

// Replaces the root layout when the layout itself fails, so none of its
// providers exist: the text comes straight from the catalogues.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const locale = useSyncExternalStore(noSubscription, localeSnapshot, buildLocale)
  return (
    <html lang={locale === 'zh' ? 'zh-Hans' : 'en'}>
      <body>
        <ErrorScreen error={error} retry={retry} text={(locale === 'zh' ? zh : en).error} />
      </body>
    </html>
  )
}
