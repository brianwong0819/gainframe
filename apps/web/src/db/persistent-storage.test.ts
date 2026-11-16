import { describe, expect, it, vi } from 'vitest'

import { readPersisted, requestPersistentStorage } from './persistent-storage'

function storage(persisted: boolean, grant: boolean) {
  return {
    persisted: vi.fn(() => Promise.resolve(persisted)),
    persist: vi.fn(() => Promise.resolve(grant)),
  }
}

describe('requestPersistentStorage', () => {
  it('does not ask again once storage is persistent', async () => {
    const manager = storage(true, false)
    expect(await requestPersistentStorage(manager)).toBe(true)
    expect(manager.persist).not.toHaveBeenCalled()
  })

  it('asks when storage is not yet persistent and returns the answer', async () => {
    const manager = storage(false, true)
    expect(await requestPersistentStorage(manager)).toBe(true)
    expect(manager.persist).toHaveBeenCalledOnce()
  })

  it('returns false where the Storage API is missing', async () => {
    expect(await requestPersistentStorage(undefined)).toBe(false)
  })
})

describe('readPersisted', () => {
  it('returns the browser answer', async () => {
    expect(await readPersisted(storage(false, false))).toBe(false)
    expect(await readPersisted(storage(true, false))).toBe(true)
  })

  it('returns null without the Storage API or when the query fails', async () => {
    expect(await readPersisted(undefined)).toBeNull()
    expect(await readPersisted({ persisted: () => Promise.reject(new Error('denied')) })).toBeNull()
  })
})
