'use client'

import { useEffect } from 'react'

// Registers the service worker that scripts/build-sw.ts writes into the
// production build; `next dev` has none.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    // A failed registration is left as an unhandled rejection on purpose: the
    // global handler in src/diagnostics (M1-03) records it.
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
  }, [])
  return null
}
