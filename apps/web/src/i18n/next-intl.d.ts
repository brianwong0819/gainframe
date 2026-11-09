import type en from '../../messages/en.json'

import type { Locale } from './locale'

// Type-checks every translation key against the English catalogue.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale
    Messages: typeof en
  }
}
