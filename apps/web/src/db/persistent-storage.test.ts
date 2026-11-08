import { describe, expect, it, vi } from 'vitest'

import { requestPersistentStorage } from './persistent-storage'

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
