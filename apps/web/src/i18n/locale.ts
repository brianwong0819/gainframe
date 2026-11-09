import { z } from 'zod'

// The app's languages. Chinese is the default: it is what the static export
// renders, and what a device whose languages include neither falls back to.
export const LOCALES = ['zh', 'en'] as const
export const localeSchema = z.enum(LOCALES)
export type Locale = z.infer<typeof localeSchema>
export const DEFAULT_LOCALE: Locale = 'zh'

/** The first of the device's preferred languages the app speaks. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const primary = language.toLowerCase().split('-')[0]
    const parsed = localeSchema.safeParse(primary)
    if (parsed.success) return parsed.data
  }
  return DEFAULT_LOCALE
}
