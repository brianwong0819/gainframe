import { detectLocale, localeSchema, type Locale } from './locale'

// The language choice is a setting of this device, read synchronously on the
// first render, so it lives in localStorage rather than Dexie. It moves to the
// synced profile (profiles.locale) with accounts in M2.
const STORAGE_KEY = 'gainframe.locale'

const listeners = new Set<() => void>()
// This session's choice, which also covers a browser that blocks storage.
let chosen: Locale | null = null

function stored(): Locale | null {
  try {
    const parsed = localeSchema.safeParse(localStorage.getItem(STORAGE_KEY))
    return parsed.success ? parsed.data : null
  } catch {
    // Storage blocked (private browsing): use the device languages.
    return null
  }
}

/** The chosen language, else the device's preferred one. For useSyncExternalStore. */
export function localeSnapshot(): Locale {
  return chosen ?? stored() ?? detectLocale(navigator.languages)
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function chooseLocale(locale: Locale): void {
  chosen = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Storage blocked: the choice lasts until the app closes.
  }
  for (const listener of listeners) listener()
}
