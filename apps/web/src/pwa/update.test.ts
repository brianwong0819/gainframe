import { describe, expect, it, vi } from 'vitest'

import { createUpdateStore } from './update'

// Minimal stand-ins: EventTarget gives the real add/dispatch behaviour.
function fakeWorker(state: ServiceWorkerState, postMessage = vi.fn()) {
  const worker = Object.assign(new EventTarget(), { state, postMessage })
  // The store only reads state, listens and posts; the cast stays in the test.
  return worker as unknown as ServiceWorker & { state: ServiceWorkerState }
}

function fakeRegistration(waiting: ServiceWorker | null = null) {
  return Object.assign(new EventTarget(), {
    waiting,
    installing: null as ServiceWorker | null,
    update: vi.fn(() => Promise.resolve(undefined)),
  })
}

function fakePage(): EventTarget & { visibilityState: DocumentVisibilityState } {
  return Object.assign(new EventTarget(), { visibilityState: 'visible' as const })
}

describe('appUpdate', () => {
  it('offers a release that was already waiting when the app opened', () => {
    const store = createUpdateStore()
    store.watch(fakeRegistration(fakeWorker('installed')), () => true, fakePage())
    expect(store.isWaiting()).toBe(true)
  })

  it('does not offer the first install, which has no controller yet', () => {
    const store = createUpdateStore()
    const registration = fakeRegistration()
    store.watch(registration, () => false, fakePage())
    const worker = fakeWorker('installing')
    registration.installing = worker
    registration.dispatchEvent(new Event('updatefound'))
    worker.state = 'installed'
    worker.dispatchEvent(new Event('statechange'))
    expect(store.isWaiting()).toBe(false)
  })

  it('offers a release found while open and tells subscribers', () => {
    const store = createUpdateStore()
    const listener = vi.fn()
    store.subscribe(listener)
    const registration = fakeRegistration()
    store.watch(registration, () => true, fakePage())
    const worker = fakeWorker('installing')
    registration.installing = worker
    registration.dispatchEvent(new Event('updatefound'))
    expect(store.isWaiting()).toBe(false)
    worker.state = 'installed'
    worker.dispatchEvent(new Event('statechange'))
    expect(store.isWaiting()).toBe(true)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('checks for a release each time the app returns to the foreground', () => {
    const store = createUpdateStore()
    const registration = fakeRegistration()
    const page = fakePage()
    store.watch(registration, () => true, page)
    page.visibilityState = 'hidden'
    page.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).not.toHaveBeenCalled()
    page.visibilityState = 'visible'
    page.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).toHaveBeenCalledOnce()
  })

  it('activates the waiting worker and reloads only once it takes control', () => {
    const store = createUpdateStore()
    const postMessage = vi.fn()
    store.watch(fakeRegistration(fakeWorker('installed', postMessage)), () => true, fakePage())
    const container = new EventTarget()
    const reload = vi.fn()
    store.apply(container, reload)
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reload).not.toHaveBeenCalled()
    container.dispatchEvent(new Event('controllerchange'))
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does nothing when no release is waiting', () => {
    const store = createUpdateStore()
    const container = new EventTarget()
    const reload = vi.fn()
    store.apply(container, reload)
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).not.toHaveBeenCalled()
  })
})
