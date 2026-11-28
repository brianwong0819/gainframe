import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearFinished,
  type FinishedSession,
  readFinished,
  stashFinished,
} from './finished-session'

const NOW = Date.parse('2026-11-28T00:00:00.000Z')

const finished: FinishedSession = {
  session: {
    userId: 'sub-1',
    email: 'someone@example.com',
    accessToken: 'access-1',
    accessExpiresAt: '2026-11-28T01:00:00.000Z',
    refreshToken: 'refresh-1',
    expired: false,
    method: 'google',
  },
  savedAt: NOW,
  reloadedAt: NOW + 5000,
}

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('finished session', () => {
  it('survives a reload until it is cleared', () => {
    expect(stashFinished(finished)).toBe(true)
    expect(readFinished(NOW + 6000)).toEqual(finished)
    clearFinished()
    expect(readFinished(NOW + 6000)).toBeNull()
  })

  it('drops a stash from an abandoned sign-in', () => {
    stashFinished(finished)
    expect(readFinished(NOW + 11 * 60 * 1000)).toBeNull()
    expect(store.size).toBe(0)
  })

  it('drops an unreadable stash', () => {
    store.set('gainframe.sign-in.finished', '{"session":{}}')
    expect(readFinished(NOW)).toBeNull()
    expect(store.size).toBe(0)
  })

  it('says so when storage is unavailable, so the page does not reload', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(stashFinished(finished)).toBe(false)
  })
})
