// A new release's service worker waits until every window of the old one is
// closed (no skipWaiting in src/sw/sw.ts), which on iOS means closing the app
// twice. This store notices the waiting worker so the app can offer the
// update, and applies it on request: Serwist's worker calls skipWaiting on a
// `SKIP_WAITING` message, and the page reloads once the new worker controls it.

type Registration = Pick<
  ServiceWorkerRegistration,
  'waiting' | 'installing' | 'addEventListener'
> & { update: () => Promise<unknown> }

export function createUpdateStore() {
  let waiting: ServiceWorker | null = null
  const listeners = new Set<() => void>()

  function setWaiting(worker: ServiceWorker) {
    waiting = worker
    for (const listener of listeners) listener()
  }

  return {
    /** For useSyncExternalStore. */
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /** Whether a new release is installed and waiting. */
    isWaiting: (): boolean => waiting !== null,

    /**
     * Watches a registration for a new release. `hasController` is false on
     * the very first install, which is not an update. Checks again whenever
     * the app returns to the foreground, since an installed app can stay open
     * for days.
     */
    watch: (
      registration: Registration,
      hasController: () => boolean,
      page: Pick<Document, 'addEventListener' | 'visibilityState'>,
    ): void => {
      if (registration.waiting !== null && hasController()) setWaiting(registration.waiting)
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        if (worker === null) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && hasController()) setWaiting(worker)
        })
      })
      page.addEventListener('visibilitychange', () => {
        if (page.visibilityState !== 'visible') return
        registration.update().catch(() => {
          // Offline or the server is unreachable: the next return checks again.
        })
      })
    },

    /** Activates the waiting release and reloads once it controls the page. */
    apply: (
      container: Pick<ServiceWorkerContainer, 'addEventListener'>,
      reload: () => void,
    ): void => {
      if (waiting === null) return
      container.addEventListener('controllerchange', reload, { once: true })
      waiting.postMessage({ type: 'SKIP_WAITING' })
    },
  }
}

// The app's one store, fed by <ServiceWorker> and read by <UpdatePrompt>.
export const appUpdate = createUpdateStore()
