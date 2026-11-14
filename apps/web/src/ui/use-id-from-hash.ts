'use client'

import { useSyncExternalStore } from 'react'

function subscribeToHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
  }
}

// The row a page shows, from the URL fragment (`/workout/plan#<id>`). A
// fragment, not a query string: the exported page is one static file, and the
// service worker's precache matches the URL without its fragment, so the page
// also opens offline. Undefined on the server render, where it is not known;
// null when the URL has none.
export function useIdFromHash(): string | null | undefined {
  return useSyncExternalStore(
    subscribeToHash,
    () => decodeURIComponent(window.location.hash.slice(1)) || null,
    () => undefined,
  )
}
