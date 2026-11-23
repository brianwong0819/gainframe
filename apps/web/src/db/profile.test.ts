import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { currentProfile, saveTargets } from './profile'
import { createRepositories } from './repositories'
import { GainframeDb } from './schema'

let db: GainframeDb
let clock: Date
let repos: ReturnType<typeof createRepositories>

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  clock = new Date('2026-11-22T10:00:00.000Z')
  repos = createRepositories(db, () => clock)
})

afterEach(() => {
  db.close()
})

const noBody = {
  sex: null,
  birthYear: null,
  heightCm: null,
  activityLevel: null,
  phase: null,
} as const

describe('daily targets', () => {
  it('has no profile until targets are saved', async () => {
    expect(await currentProfile(db)).toBeUndefined()
  })

  it('creates the profile once and updates it after', async () => {
    const created = await saveTargets(db, repos, { proteinG: 140, kcal: 2800 })
    clock = new Date('2026-11-22T11:00:00.000Z')
    const updated = await saveTargets(db, repos, { proteinG: 150, kcal: 2900 })

    expect(updated.id).toBe(created.id)
    expect(await currentProfile(db)).toMatchObject({
      proteinMode: 'fixed',
      proteinValue: 150,
      kcalTarget: 2900,
    })
    expect(await db.profiles.count()).toBe(1)
    expect(await db.outbox.count()).toBe(2)
  })

  it('reads the latest of two profiles made on two devices, and writes to it', async () => {
    const older = await repos.profiles.create({
      proteinMode: 'fixed',
      proteinValue: 120,
      kcalTarget: 2500,
      ...noBody,
    })
    clock = new Date('2026-11-22T11:00:00.000Z')
    const newer = await repos.profiles.create({
      proteinMode: 'fixed',
      proteinValue: 160,
      kcalTarget: 3000,
      ...noBody,
    })
    expect((await currentProfile(db))?.id).toBe(newer.id)

    clock = new Date('2026-11-22T12:00:00.000Z')
    await saveTargets(db, repos, { proteinG: 155, kcal: 3000 })
    expect((await currentProfile(db))?.id).toBe(newer.id)
    expect((await db.profiles.get(older.id))?.proteinValue).toBe(120)
  })

  it('ignores a deleted profile', async () => {
    const profile = await saveTargets(db, repos, { proteinG: 140, kcal: 2800 })
    await repos.profiles.remove(profile.id)
    expect(await currentProfile(db)).toBeUndefined()
  })
})
