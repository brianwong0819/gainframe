import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createRepositories, type Repositories } from '../../../db/repositories'
import { GainframeDb } from '../../../db/schema'

import { logSampleWorkout, removeSamplesFromAppDb } from './sample'

const now = new Date('2026-11-09T10:00:00.000Z')

let db: GainframeDb
let repos: Repositories

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  repos = createRepositories(db, () => now)
})

afterEach(() => {
  db.close()
})

async function liveCount(table: 'exercises' | 'workouts' | 'workoutSets') {
  return db[table].filter((row) => row.deletedAt === null).count()
}

describe('removeSamplesFromAppDb', () => {
  it('removes sample workouts, their sets and the sample exercise', async () => {
    await logSampleWorkout(repos, now)
    await logSampleWorkout(repos, now)

    expect(await removeSamplesFromAppDb(db, repos)).toEqual({ exercises: 2, workouts: 2 })
    expect(await liveCount('exercises')).toBe(0)
    expect(await liveCount('workouts')).toBe(0)
    expect(await liveCount('workoutSets')).toBe(0)
  })

  it('keeps other exercises, and a workout that mixes in a real exercise', async () => {
    await logSampleWorkout(repos, now)
    const own = await repos.exercises.create({
      nameZh: '杠铃卧推',
      nameEn: 'Barbell bench press',
      muscle: 'chest',
      equipment: 'barbell',
      defaultRestS: 90,
    })
    const sampleSet = (await db.workoutSets.toArray())[0]
    if (sampleSet === undefined) throw new Error('no sample set')
    await repos.workoutSets.create({ ...sampleSet, exerciseId: own.id, position: 3 })

    expect(await removeSamplesFromAppDb(db, repos)).toEqual({ exercises: 0, workouts: 0 })
    expect(await liveCount('exercises')).toBe(2)
    expect(await liveCount('workouts')).toBe(1)
  })

  it('does nothing twice', async () => {
    await logSampleWorkout(repos, now)
    await removeSamplesFromAppDb(db, repos)
    expect(await removeSamplesFromAppDb(db, repos)).toEqual({ exercises: 0, workouts: 0 })
  })
})
