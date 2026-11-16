'use client'

import { useEffect } from 'react'

import { appUpdate } from './update'

// Registers the service worker that scripts/build-sw.ts writes into the
// production build; `next dev` has none. Then watches it for a new release,
// which <UpdatePrompt> offers.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    const container = navigator.serviceWorker
    // A failed registration is left as an unhandled rejection on purpose: the
    // global handler in src/diagnostics (M1-03) records it.
    void container.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    // `ready` resolves once a worker is active, with the same registration;
    // it never resolves where workers are blocked (the e2e configuration).
    void container.ready.then((registration) => {
      appUpdate.watch(registration, () => container.controller !== null, document)
    })
  }, [])
  return null
}
