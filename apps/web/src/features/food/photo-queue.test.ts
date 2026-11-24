import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type FoodEstimateResponse, localDateSchema } from '@gainframe/shared'

import { type ApiClient, ApiRequestError } from '../../api/client'
import { logMeal } from '../../db/food'
import { keepPhoto, pendingPhotosOn, photosToEstimate } from '../../db/pending-photos'
import { createRepositories } from '../../db/repositories'
import { GainframeDb } from '../../db/schema'

import { estimateKeptPhotos } from './photo-queue'

const KL = 'Asia/Kuala_Lumpur'
const photo = { type: 'image/jpeg' as const, base64: 'AAAA' }

const reply = (items: number, photoIssue: FoodEstimateResponse['photoIssue'] = null) =>
  ({
    dishName: items === 0 ? null : 'Chicken rice',
    photoIssue,
    items: Array.from({ length: items }, () => ({
      name: 'Chicken rice',
      entryId: 'myfcd-1',
      grams: 350,
      proteinG: 25,
      kcal: 600,
      nutrients: 'table' as const,
      confidence: 'high' as const,
      alternativeIds: [],
      raw: {
        seen: 'rice with chicken',
        entryId: 'myfcd-1',
        grams: 350,
        confidence: 'high' as const,
        alternativeIds: [],
        proteinPer100G: null,
        kcalPer100G: null,
      },
    })),
    model: 'fake',
    promptVersion: 2,
  }) satisfies FoodEstimateResponse

let db: GainframeDb
// What the fake API answers, one entry per request in order.
let answers: (FoodEstimateResponse | Error)[]
let sent: number

const api: ApiClient = {
  request: (schema) => {
    sent += 1
    const answer = answers.shift() ?? new Error('no answer left')
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(schema.parse(answer))
  },
}

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  answers = []
  sent = 0
})

afterEach(() => {
  db.close()
})

const keep = (takenAt: string) => keepPhoto(db, { takenAt, timeZone: KL, mealType: 'lunch', photo })

describe('photos kept while offline', () => {
  it('counts for the day it was taken in the device time zone', async () => {
    // 17:30 UTC is 01:30 the next day in Kuala Lumpur.
    const kept = await keep('2026-11-23T17:30:00.000Z')
    expect(kept.localDate).toBe('2026-11-24')
    expect(await pendingPhotosOn(db, localDateSchema.parse('2026-11-24'))).toEqual([kept])
    expect(await pendingPhotosOn(db, localDateSchema.parse('2026-11-23'))).toEqual([])
  })

  it('are estimated oldest first and keep the estimate for the user to confirm', async () => {
    const later = await keep('2026-11-24T05:00:00.000Z')
    const earlier = await keep('2026-11-24T04:00:00.000Z')
    answers = [reply(1), reply(2)]
    expect(await estimateKeptPhotos(db, api)).toBe(2)
    expect((await db.pendingPhotos.get(earlier.id))?.estimate?.items).toHaveLength(1)
    expect((await db.pendingPhotos.get(later.id))?.estimate?.items).toHaveLength(2)
    expect(await photosToEstimate(db)).toEqual([])
    // A later run sends nothing again.
    expect(await estimateKeptPhotos(db, api)).toBe(0)
    expect(sent).toBe(2)
  })

  it('stop for a photo the model cannot count and go on with the next', async () => {
    const dark = await keep('2026-11-24T04:00:00.000Z')
    const fine = await keep('2026-11-24T05:00:00.000Z')
    answers = [reply(0, 'dark'), reply(1)]
    expect(await estimateKeptPhotos(db, api)).toBe(1)
    expect(await db.pendingPhotos.get(dark.id)).toMatchObject({ estimate: null, stoppedBy: 'dark' })
    expect((await db.pendingPhotos.get(fine.id))?.estimate).not.toBeNull()
  })

  it('stop for an account without AI features', async () => {
    const kept = await keep('2026-11-24T04:00:00.000Z')
    answers = [new ApiRequestError(403, 'ai_not_enabled', 'request-1')]
    await estimateKeptPhotos(db, api)
    expect((await db.pendingPhotos.get(kept.id))?.stoppedBy).toBe('notEnabled')
  })

  it('keep waiting after a problem worth retrying, and end the run there', async () => {
    const first = await keep('2026-11-24T04:00:00.000Z')
    await keep('2026-11-24T05:00:00.000Z')
    answers = [new ApiRequestError(429, 'ai_capped', 'request-1')]
    expect(await estimateKeptPhotos(db, api)).toBe(0)
    expect(sent).toBe(1)
    expect(await db.pendingPhotos.get(first.id)).toMatchObject({ estimate: null, stoppedBy: null })
    expect(await photosToEstimate(db)).toHaveLength(2)

    answers = [new TypeError('Load failed')]
    expect(await estimateKeptPhotos(db, api)).toBe(0)
    expect(await photosToEstimate(db)).toHaveLength(2)
  })

  it('wait in a build without sign-in', async () => {
    await keep('2026-11-24T04:00:00.000Z')
    expect(await estimateKeptPhotos(db, null)).toBe(0)
    expect(await photosToEstimate(db)).toHaveLength(1)
  })

  it('are replaced by the meal they are logged as, in one transaction', async () => {
    const kept = await keep('2026-11-23T17:30:00.000Z')
    const repos = createRepositories(db)
    const meal = await logMeal(db, repos, {
      eatenAt: kept.takenAt,
      timeZone: KL,
      mealType: kept.mealType,
      items: [],
      pendingPhotoId: kept.id,
    })
    expect(meal.localDate).toBe('2026-11-24')
    expect(await db.pendingPhotos.count()).toBe(0)
  })
})
