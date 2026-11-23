import { randomUUID } from 'node:crypto'

import {
  BUILT_IN_EXERCISES,
  pullResponseSchema,
  pushResponseSchema,
  SYNC_VERSION,
  SYNC_VERSION_HEADER,
  TOKEN_HEADER,
} from '@gainframe/shared'
import type { MiddlewareHandler } from 'hono'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import type { AppEnv } from '../context.ts'
import { createDatabase, createPool } from '../db/client.ts'
import { aiUsage } from '../db/schema.ts'
import { parseDatabaseUrl } from '../env.ts'
import { createLogger } from '../log.ts'

const log = createLogger({ release: 'test', write: () => undefined })
const pool = createPool(parseDatabaseUrl(process.env), log)
const db = createDatabase(pool)
const NOW = new Date('2026-11-23T12:00:00.000Z')

// Stands in for auth.ts: the token is the user's `sub`, and the user name is
// derived from it, as Cognito's differs from `sub` for a Google-only user.
const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const sub = c.req.header(TOKEN_HEADER)?.replace('Bearer ', '') ?? ''
  c.set('userId', sub)
  c.set('username', `name-of-${sub}`)
  return next()
}
const deletedIdentities: string[] = []
let identityFails = false
const app = createApp({
  log,
  requireUser,
  db,
  deleteIdentity: (username) => {
    if (identityFails) return Promise.reject(new Error('Cognito unavailable'))
    deletedIdentities.push(username)
    return Promise.resolve()
  },
  generate: () => Promise.reject(new Error('no AI route here')),
  now: () => NOW,
})

afterAll(async () => {
  await pool.end()
})

const uuidv7 = () => randomUUID().replace(/^(.{14})4/, '$17')
const newUser = () => `user-${randomUUID()}`
const iso = NOW.toISOString()

function headers(user: string) {
  return { [TOKEN_HEADER]: `Bearer ${user}`, [SYNC_VERSION_HEADER]: String(SYNC_VERSION) }
}

async function pushWorkoutAndSet(user: string) {
  const workoutId = uuidv7()
  const res = await app.request('/api/sync/push', {
    method: 'POST',
    headers: { ...headers(user), 'content-type': 'application/json' },
    body: JSON.stringify({
      rows: [
        {
          table: 'workouts',
          row: {
            id: workoutId,
            createdAt: iso,
            updatedAt: iso,
            deletedAt: null,
            startedAt: iso,
            endedAt: iso,
            localDate: '2026-11-23',
            planDayId: null,
            note: null,
            restStartedAt: null,
            restEndsAt: null,
          },
        },
        {
          table: 'workoutSets',
          row: {
            id: uuidv7(),
            createdAt: iso,
            updatedAt: iso,
            deletedAt: null,
            workoutExerciseId: uuidv7(),
            workoutId,
            exerciseId: BUILT_IN_EXERCISES[0]?.id,
            position: 0,
            kind: 'working',
            weightKg: 60,
            reps: 8,
            rpe: null,
            completedAt: iso,
          },
        },
      ],
    }),
  })
  expect(res.status).toBe(200)
  const { results } = pushResponseSchema.parse(await res.json())
  expect(results.map((result) => result.status)).toEqual(['applied', 'applied'])
}

async function pulledRows(user: string) {
  const res = await app.request('/api/sync/pull?cursor=0', { headers: headers(user) })
  expect(res.status).toBe(200)
  return pullResponseSchema.parse(await res.json()).rows.length
}

function deleteAccount(user: string) {
  return app.request('/api/account', { method: 'DELETE', headers: headers(user) })
}

describe('DELETE /api/account', () => {
  it("removes every row of the user and the identity, and leaves another user's rows", async () => {
    const a = newUser()
    const b = newUser()
    await pushWorkoutAndSet(a)
    await pushWorkoutAndSet(b)
    for (const userId of [a, b]) {
      await db.insert(aiUsage).values({ userId, day: '2026-11-23', feature: 'test', calls: 1 })
    }
    const usageOf = (userId: string) => db.select().from(aiUsage).where(eq(aiUsage.userId, userId))

    const res = await deleteAccount(a)

    expect(res.status).toBe(204)
    expect(await pulledRows(a)).toBe(0)
    expect(await pulledRows(b)).toBe(2)
    expect(await usageOf(a)).toHaveLength(0)
    expect(await usageOf(b)).toHaveLength(1)
    expect(deletedIdentities).toContain(`name-of-${a}`)
    expect(deletedIdentities).not.toContain(`name-of-${b}`)
  })

  it('refuses a later push with a token that outlived the account, and stores nothing', async () => {
    const a = newUser()
    await pushWorkoutAndSet(a)
    expect((await deleteAccount(a)).status).toBe(204)

    const res = await app.request('/api/sync/push', {
      method: 'POST',
      headers: { ...headers(a), 'content-type': 'application/json' },
      body: JSON.stringify({
        rows: [
          {
            table: 'exercises',
            row: {
              id: uuidv7(),
              createdAt: iso,
              updatedAt: iso,
              deletedAt: null,
              nameZh: null,
              nameEn: 'Landmine press',
              muscle: 'shoulders',
              secondaryMuscles: [],
              equipment: 'barbell',
              defaultRestS: 90,
            },
          },
        ],
      }),
    })

    expect(res.status).toBe(401)
    expect(await pulledRows(a)).toBe(0)
  })

  it('can be retried when the identity could not be deleted', async () => {
    const a = newUser()
    await pushWorkoutAndSet(a)

    identityFails = true
    expect((await deleteAccount(a)).status).toBe(500)
    expect(await pulledRows(a)).toBe(0)

    identityFails = false
    expect((await deleteAccount(a)).status).toBe(204)
    expect(deletedIdentities).toContain(`name-of-${a}`)
  })
})
