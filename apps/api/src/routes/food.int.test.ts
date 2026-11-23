import { randomUUID } from 'node:crypto'

import {
  apiErrorSchema,
  type EstimateAiRaw,
  FOOD_ESTIMATE_BODY_BYTES_MAX,
  foodEstimateResponseSchema,
  TEXT_MEAL_CHARS_MAX,
  textEstimateResponseSchema,
  TOKEN_HEADER,
  type VisionItem,
} from '@gainframe/shared'
import { FOOD_TABLE } from '@gainframe/shared/food-table'
import type { MiddlewareHandler } from 'hono'
import { afterAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { aiConfig } from '../ai/config.ts'
import { fakeProvider, type FakeStep, reply } from '../ai/fake.ts'
import { createAi } from '../ai/generate.ts'
import { usageStore } from '../ai/usage.ts'
import { createApp } from '../app.ts'
import type { AppEnv } from '../context.ts'
import { createDatabase, createPool } from '../db/client.ts'
import { aiUsage, foods, mealItems } from '../db/schema.ts'
import { parseDatabaseUrl } from '../env.ts'
import { createLogger } from '../log.ts'

const pool = createPool(parseDatabaseUrl(process.env), createLogger({ release: 'test' }))
const db = createDatabase(pool)

afterAll(async () => {
  await pool.end()
})

// Stands in for auth.ts: the token is the user's `sub`; a user whose `sub`
// starts with `no-ai-` is not in the AI group.
const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const userId = c.req.header(TOKEN_HEADER)?.replace('Bearer ', '') ?? ''
  c.set('userId', userId)
  c.set('aiAllowed', !userId.startsWith('no-ai-'))
  return next()
}

const lineSchema = z.record(z.string(), z.unknown())

function setup(steps: readonly FakeStep[]) {
  const lines: string[] = []
  const log = createLogger({ release: 'test', write: (line) => lines.push(line) })
  const provider = fakeProvider(steps)
  const app = createApp({
    log,
    requireUser,
    db,
    deleteIdentity: () => Promise.resolve(),
    generate: createAi({ provider, usage: usageStore(db) }),
  })
  const aiLine = () =>
    lines.map((line) => lineSchema.parse(JSON.parse(line))).find((l) => l.msg === 'ai call')
  return { app, provider, aiLine }
}

const newUser = () => `user-${randomUUID()}`
const uuidv7 = () => randomUUID().replace(/^(.{14})4/, '$17')
const [rice, egg] = [FOOD_TABLE[0], FOOD_TABLE[1]]
if (rice === undefined || egg === undefined) throw new Error('food table is empty')

const item = (overrides: Partial<VisionItem>): VisionItem => ({
  seen: 'white rice',
  entryId: rice.id,
  grams: 200,
  confidence: 'high',
  alternativeIds: [egg.id],
  proteinPer100G: null,
  kcalPer100G: null,
  ...overrides,
})

const modelReply = (...items: VisionItem[]) =>
  reply(JSON.stringify({ dishName: 'Rice', photoIssue: null, items }))

const photo = { type: 'image/jpeg', base64: Buffer.from('a jpeg').toString('base64') }

function estimate(app: ReturnType<typeof setup>['app'], user: string, body: unknown = { photo }) {
  return app.request('/api/food/estimate', {
    method: 'POST',
    headers: { [TOKEN_HEADER]: `Bearer ${user}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function errorCode(res: Response) {
  return apiErrorSchema.parse(await res.json()).error.code
}

async function storeItem(user: string, name: string, aiRaw: EstimateAiRaw, deleted = false) {
  const now = new Date().toISOString()
  await db.insert(mealItems).values({
    id: randomUUID(),
    userId: user,
    createdAt: now,
    updatedAt: now,
    deletedAt: deleted ? now : null,
    serverVersion: 1,
    mealId: randomUUID(),
    position: 0,
    name,
    grams: 150,
    proteinG: 10,
    kcal: 200,
    source: 'ai',
    aiRaw,
  })
}

const textOf = (request: { messages: readonly { content: readonly { type: string }[] }[] }) =>
  JSON.stringify(request.messages[0]?.content.filter((block) => block.type === 'text'))

describe('POST /api/food/estimate', () => {
  it('returns the items with protein and energy from the food table', async () => {
    const { app, provider, aiLine } = setup([modelReply(item({}))])
    const res = await estimate(app, newUser())

    expect(res.status).toBe(200)
    const body = foodEstimateResponseSchema.parse(await res.json())
    expect(body).toMatchObject({
      dishName: 'Rice',
      model: aiConfig.features.vision.model,
      promptVersion: aiConfig.features.vision.promptVersion,
    })
    expect(body.items).toEqual([
      expect.objectContaining({
        entryId: rice.id,
        name: rice.nameEn,
        grams: 200,
        proteinG: rice.proteinPer100G * 2,
        kcal: rice.kcalPer100G * 2,
        nutrients: 'table',
        alternativeIds: [egg.id],
      }),
    ])
    const request = provider.requests[0]
    // Ids and names only: the entry's line carries no figures.
    expect(request?.system.split('\n')).toContain(
      [rice.id, rice.nameEn, ...rice.aliases].join('\t'),
    )
    expect(request?.messages[0]?.content[0]).toEqual({
      type: 'image',
      mediaType: 'image/jpeg',
      data: photo.base64,
    })
    expect(aiLine()).toMatchObject({ feature: 'vision', outcome: 'ok' })
  })

  it('retries once when the model names an id the table does not have', async () => {
    const { app, provider, aiLine } = setup([
      modelReply(item({ entryId: 'usda-0' })),
      modelReply(item({})),
    ])
    const res = await estimate(app, newUser())

    expect(res.status).toBe(200)
    expect(JSON.stringify(provider.requests[1]?.messages.at(-1))).toContain('not a food table id')
    expect(aiLine()).toMatchObject({ outcome: 'retried' })
  })

  it("sends the user's own remembered corrections, and no one else's", async () => {
    const [user, other] = [newUser(), newUser()]
    const remembered: EstimateAiRaw = {
      ...item({ seen: 'yellow rice' }),
      remember: true,
      oilSauce: 'usual',
    }
    await storeItem(user, 'Nasi minyak', remembered)
    await storeItem(user, 'Forgotten', { ...remembered, remember: false })
    await storeItem(user, 'Deleted', remembered, true)
    await storeItem(other, 'Not mine', remembered)
    const { app, provider } = setup([modelReply(item({}))])
    await estimate(app, user)

    const text = textOf(provider.requests[0] ?? { messages: [] })
    expect(text).toContain('you saw \\"yellow rice\\"')
    expect(text).toContain('Nasi minyak')
    expect(text).not.toMatch(/Forgotten|Deleted|Not mine/)
  })

  it("counts an entry with the user's own edit of it, and not another user's", async () => {
    const [user, other] = [newUser(), newUser()]
    const now = new Date().toISOString()
    const editOf = (owner: string, proteinPer100G: number) => ({
      id: uuidv7(),
      userId: owner,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      serverVersion: 1,
      tableId: rice.id,
      name: `Rice of ${owner}`,
      proteinPer100G,
      kcalPer100G: 100,
      servings: [{ label: null, grams: 200 }],
    })
    await db.insert(foods).values([editOf(user, 5), editOf(other, 50)])

    const mine = await estimate(setup([modelReply(item({}))]).app, user)
    expect(foodEstimateResponseSchema.parse(await mine.json()).items[0]).toMatchObject({
      name: `Rice of ${user}`,
      proteinG: 10,
      kcal: 200,
    })
    const theirs = await estimate(setup([modelReply(item({}))]).app, newUser())
    expect(foodEstimateResponseSchema.parse(await theirs.json()).items[0]).toMatchObject({
      name: rice.nameEn,
      proteinG: rice.proteinPer100G * 2,
    })
  })

  it('answers 403 for a user outside the AI group, without calling the model', async () => {
    const { app, provider } = setup([])
    const res = await estimate(app, `no-ai-${randomUUID()}`)

    expect(res.status).toBe(403)
    expect(await errorCode(res)).toBe('ai_not_enabled')
    expect(provider.requests).toEqual([])
  })

  it('answers 429 once the daily cap is used, without calling the model', async () => {
    const user = newUser()
    await db.insert(aiUsage).values({
      userId: user,
      day: new Date().toISOString().slice(0, 10),
      feature: 'vision',
      calls: aiConfig.features.vision.dailyCap,
    })
    const { app, provider } = setup([])
    const res = await estimate(app, user)

    expect(res.status).toBe(429)
    expect(await errorCode(res)).toBe('ai_capped')
    expect(provider.requests).toEqual([])
  })

  it('answers 200 with the photo issue when no food can be named', async () => {
    const noFood = reply(JSON.stringify({ dishName: null, photoIssue: 'dark', items: [] }))
    const res = await estimate(setup([noFood]).app, newUser())
    expect(res.status).toBe(200)
    expect(foodEstimateResponseSchema.parse(await res.json())).toMatchObject({
      photoIssue: 'dark',
      items: [],
    })
  })

  it('answers 422 for a refusal and 503 when the model cannot be reached', async () => {
    const refused = await estimate(setup([reply('', 'refusal')]).app, newUser())
    expect(refused.status).toBe(422)
    expect(await errorCode(refused)).toBe('ai_refused')

    const failed = await estimate(setup([{ throws: new Error('503') }]).app, newUser())
    expect(failed.status).toBe(503)
    expect(await errorCode(failed)).toBe('ai_unavailable')
  })

  it('rejects a body without a valid photo and one over the size limit', async () => {
    const { app, provider } = setup([])
    const invalid = await estimate(app, newUser(), { photo: { type: 'image/gif', base64: 'AAAA' } })
    expect(invalid.status).toBe(400)

    const huge = { photo: { ...photo, base64: 'A'.repeat(FOOD_ESTIMATE_BODY_BYTES_MAX) } }
    expect((await estimate(app, newUser(), huge)).status).toBe(413)
    expect(provider.requests).toEqual([])
  })
})

describe('POST /api/food/estimate-text', () => {
  const question = { question: '饭是一碗还是半碗？', options: ['半碗', '一碗', '两碗'] }
  const textReply = (questions: (typeof question)[], ...items: VisionItem[]) =>
    reply(JSON.stringify({ dishName: 'Rice', questions, assumptions: '假设一碗饭。', items }))
  const describeMeal = (app: ReturnType<typeof setup>['app'], user: string, body: unknown) =>
    app.request('/api/food/estimate-text', {
      method: 'POST',
      headers: { [TOKEN_HEADER]: `Bearer ${user}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('returns the best estimate with its questions and assumptions', async () => {
    const { app, provider, aiLine } = setup([textReply([question], item({}))])
    const res = await describeMeal(app, newUser(), { text: '一碗白饭', locale: 'zh', answers: [] })

    expect(res.status).toBe(200)
    const body = textEstimateResponseSchema.parse(await res.json())
    expect(body).toMatchObject({ questions: [question], assumptions: '假设一碗饭。' })
    expect(body.items).toEqual([
      expect.objectContaining({ entryId: rice.id, proteinG: rice.proteinPer100G * 2 }),
    ])
    expect(textOf(provider.requests[0] ?? { messages: [] })).toContain('一碗白饭')
    expect(aiLine()).toMatchObject({ feature: 'textMeal', outcome: 'ok' })
  })

  it('sends the answers and asks no more questions after them', async () => {
    const { app, provider } = setup([textReply([question], item({ grams: 100 }))])
    const answers = [{ question: question.question, answer: '半碗' }]
    const res = await describeMeal(app, newUser(), { text: '一碗白饭', locale: 'zh', answers })

    const body = textEstimateResponseSchema.parse(await res.json())
    expect(body.questions).toEqual([])
    expect(textOf(provider.requests[0] ?? { messages: [] })).toContain('半碗')
  })

  it('rejects an empty or overlong description without calling the model', async () => {
    const { app, provider } = setup([])
    const empty = await describeMeal(app, newUser(), { text: ' ', locale: 'zh', answers: [] })
    expect(empty.status).toBe(400)
    const long = await describeMeal(app, newUser(), {
      text: 'x'.repeat(TEXT_MEAL_CHARS_MAX + 1),
      locale: 'en',
      answers: [],
    })
    expect(long.status).toBe(400)
    expect(provider.requests).toEqual([])
  })

  it('answers 403 for a user outside the AI group, without calling the model', async () => {
    const { app, provider } = setup([])
    const res = await describeMeal(app, `no-ai-${randomUUID()}`, {
      text: 'two eggs',
      locale: 'en',
      answers: [],
    })
    expect(res.status).toBe(403)
    expect(await errorCode(res)).toBe('ai_not_enabled')
    expect(provider.requests).toEqual([])
  })

  it('answers 503 when the model cannot be reached', async () => {
    const res = await describeMeal(setup([{ throws: new Error('404') }]).app, newUser(), {
      text: 'two eggs',
      locale: 'en',
      answers: [],
    })
    expect(res.status).toBe(503)
    expect(await errorCode(res)).toBe('ai_unavailable')
  })
})
