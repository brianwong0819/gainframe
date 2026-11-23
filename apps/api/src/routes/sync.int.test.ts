import { randomUUID } from 'node:crypto'

import {
  BUILT_IN_EXERCISES,
  pullResponseSchema,
  pushResponseSchema,
  SYNC_VERSION,
  SYNC_VERSION_HEADER,
  type SyncedTableName,
  TOKEN_HEADER,
} from '@gainframe/shared'
import type { MiddlewareHandler } from 'hono'
import { afterAll, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import type { AppEnv } from '../context.ts'
import { createDatabase, createPool } from '../db/client.ts'
import { parseDatabaseUrl } from '../env.ts'
import { createLogger } from '../log.ts'
import { pullRows } from '../sync/pull.ts'

const lines: string[] = []
const log = createLogger({ release: 'test', write: (line) => lines.push(line) })
const pool = createPool(parseDatabaseUrl(process.env), log)
const db = createDatabase(pool)
const NOW = new Date('2026-11-22T12:00:00.000Z')

// Stands in for auth.ts: the token is the user's `sub`.
const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('userId', c.req.header(TOKEN_HEADER)?.replace('Bearer ', '') ?? '')
  return next()
}
const app = createApp({ log, requireUser, db, now: () => NOW })

afterAll(async () => {
  await pool.end()
})

// A random version 4 UUID with the version digit set to 7, which is all the schema checks.
const uuidv7 = () => randomUUID().replace(/^(.{14})4/, '$17')
// Each test signs in as a new user, so tests share the database without clearing it.
const newUser = () => `user-${randomUUID()}`
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString()

function headers(user: string) {
  return { [TOKEN_HEADER]: `Bearer ${user}`, [SYNC_VERSION_HEADER]: String(SYNC_VERSION) }
}

async function push(user: string, rows: { table: SyncedTableName; row: object }[]) {
  const res = await app.request('/api/sync/push', {
    method: 'POST',
    headers: { ...headers(user), 'content-type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  expect(res.status).toBe(200)
  return pushResponseSchema.parse(await res.json()).results.map((result) => result.status)
}

async function pull(user: string, cursor = 0) {
  const res = await app.request(`/api/sync/pull?cursor=${String(cursor)}`, {
    headers: headers(user),
  })
  expect(res.status).toBe(200)
  return pullResponseSchema.parse(await res.json())
}

function workoutSet(updatedAt: string, values: { id?: string; reps?: number } = {}) {
  return {
    table: 'workoutSets' as const,
    row: {
      id: values.id ?? uuidv7(),
      createdAt: at(-60),
      updatedAt,
      deletedAt: null,
      workoutExerciseId: uuidv7(),
      workoutId: uuidv7(),
      exerciseId: BUILT_IN_EXERCISES[0]?.id,
      position: 0,
      kind: 'working',
      weightKg: 60,
      reps: values.reps ?? 8,
      rpe: null,
      completedAt: updatedAt,
    },
  }
}

function customExercise(id: string) {
  return {
    table: 'exercises' as const,
    row: {
      id,
      createdAt: at(-60),
      updatedAt: at(-60),
      deletedAt: null,
      nameZh: null,
      nameEn: 'Landmine press',
      muscle: 'shoulders',
      secondaryMuscles: ['triceps'],
      equipment: 'barbell',
      defaultRestS: 90,
    },
  }
}

function meal(id: string) {
  return {
    table: 'meals' as const,
    row: {
      id,
      createdAt: at(-30),
      updatedAt: at(-30),
      deletedAt: null,
      eatenAt: at(-40),
      localDate: '2026-11-22',
      mealType: 'lunch',
      name: 'Chicken rice',
      photoKey: null,
    },
  }
}

function mealItem(mealId: string) {
  return {
    table: 'mealItems' as const,
    row: {
      id: uuidv7(),
      createdAt: at(-30),
      updatedAt: at(-30),
      deletedAt: null,
      mealId,
      position: 0,
      name: 'Steamed chicken',
      grams: 150.5,
      proteinG: 32.5,
      kcal: 280,
      source: 'ai',
      aiRaw: { name: 'Roast chicken', grams: 120, alternatives: ['Steamed chicken'] },
    },
  }
}

function profile() {
  return {
    table: 'profiles' as const,
    row: {
      id: uuidv7(),
      createdAt: at(-30),
      updatedAt: at(-30),
      deletedAt: null,
      proteinMode: 'fixed',
      proteinValue: 125,
      kcalTarget: 2750,
      sex: 'male',
      birthYear: 2001,
      heightCm: 175.5,
      activityLevel: 'moderate',
      phase: 'bulk',
    },
  }
}

function bodyMetric() {
  return {
    table: 'bodyMetrics' as const,
    row: {
      id: uuidv7(),
      createdAt: at(-30),
      updatedAt: at(-30),
      deletedAt: null,
      measuredAt: at(-30),
      localDate: '2026-11-23',
      weightKg: 62.4,
      bodyFatPct: null,
      skeletalMuscleKg: null,
      fatMassKg: null,
      source: 'manual',
    },
  }
}

describe('sync (real Postgres)', () => {
  it('asks an app without a supported sync version to update', async () => {
    const res = await app.request('/api/sync/pull', {
      headers: { [TOKEN_HEADER]: `Bearer ${newUser()}` },
    })
    expect(res.status).toBe(426)
  })

  it.each(['1', '2', '3'])(
    'asks a version %s app, which cannot read the newer tables, to update',
    async (version) => {
      const res = await app.request('/api/sync/pull', {
        headers: { ...headers(newUser()), [SYNC_VERSION_HEADER]: version },
      })
      expect(res.status).toBe(426)
    },
  )

  it("round-trips a meal and its items, the model's estimate included, to its owner only", async () => {
    const userA = newUser()
    const lunch = meal(uuidv7())
    const item = mealItem(lunch.row.id)
    expect(await push(userA, [lunch, item])).toEqual(['applied', 'applied'])

    expect((await pull(userA)).rows).toEqual([
      { table: 'meals', row: { ...lunch.row, userId: userA } },
      { table: 'mealItems', row: { ...item.row, userId: userA } },
    ])
    expect((await pull(newUser())).rows).toEqual([])
  })

  it('round-trips the profile body fields and a weigh-in to their owner only', async () => {
    const userA = newUser()
    const goals = profile()
    const weighIn = bodyMetric()
    expect(await push(userA, [goals, weighIn])).toEqual(['applied', 'applied'])

    expect((await pull(userA)).rows).toEqual([
      { table: 'profiles', row: { ...goals.row, userId: userA } },
      { table: 'bodyMetrics', row: { ...weighIn.row, userId: userA } },
    ])
    expect((await pull(newUser())).rows).toEqual([])
  })

  it('pulls pushed rows back as they were sent, once', async () => {
    const user = newUser()
    const set = workoutSet(at(-10))
    expect(await push(user, [set])).toEqual(['applied'])

    const first = await pull(user)
    expect(first.rows).toEqual([{ table: 'workoutSets', row: { ...set.row, userId: user } }])
    expect(first.more).toBe(false)
    expect((await pull(user, first.cursor)).rows).toEqual([])
  })

  it('ignores a replayed batch, so a retry after a lost response changes nothing', async () => {
    const user = newUser()
    const batch = [workoutSet(at(-10)), workoutSet(at(-9))]
    expect(await push(user, batch)).toEqual(['applied', 'applied'])
    const { cursor } = await pull(user)

    expect(await push(user, batch)).toEqual(['ignored', 'ignored'])
    expect((await pull(user, cursor)).rows).toEqual([])
  })

  it('keeps the later edit whole when two devices edit the same set before either syncs', async () => {
    // The phone changes reps to 10 at -5 min; the laptop, offline, had changed
    // them to 6 at -8 min and syncs afterwards. Last writer wins by `updatedAt`,
    // not by arrival: the laptop's older edit is ignored and is lost.
    const user = newUser()
    const id = uuidv7()
    expect(await push(user, [workoutSet(at(-20), { id })])).toEqual(['applied'])
    expect(await push(user, [workoutSet(at(-5), { id, reps: 10 })])).toEqual(['applied'])
    expect(await push(user, [workoutSet(at(-8), { id, reps: 6 })])).toEqual(['ignored'])

    const { rows } = await pull(user)
    expect(rows.map(({ row }) => row.reps)).toEqual([10])
  })

  it('syncs a delete as a tombstone', async () => {
    const user = newUser()
    const set = workoutSet(at(-10))
    await push(user, [set])
    const { cursor } = await pull(user)

    const deleted = { ...set, row: { ...set.row, updatedAt: at(-1), deletedAt: at(-1) } }
    expect(await push(user, [deleted])).toEqual(['applied'])
    const { rows } = await pull(user, cursor)
    expect(rows.map(({ row }) => row.deletedAt)).toEqual([at(-1)])
  })

  it("never shows or changes another user's rows", async () => {
    const userA = newUser()
    const userB = newUser()
    const set = workoutSet(at(-10))
    await push(userA, [set])

    expect((await pull(userB)).rows).toEqual([])
    const takeover = workoutSet(at(-1), { id: set.row.id, reps: 1 })
    const res = await app.request('/api/sync/push', {
      method: 'POST',
      headers: { ...headers(userB), 'content-type': 'application/json' },
      body: JSON.stringify({ rows: [takeover] }),
    })
    expect(pushResponseSchema.parse(await res.json()).results).toEqual([
      { status: 'rejected', reason: 'not_owned', issues: ['id'] },
    ])
    expect((await pull(userA)).rows.map(({ row }) => row.reps)).toEqual([8])
  })

  it('rejects bad rows one by one and stores the rest', async () => {
    const user = newUser()
    const invalid = workoutSet(at(-10), { reps: -1 })
    const ahead = workoutSet(at(10))
    const unknownExercise = workoutSet(at(-10))
    unknownExercise.row.exerciseId = uuidv7()
    const res = await app.request('/api/sync/push', {
      method: 'POST',
      headers: { ...headers(user), 'content-type': 'application/json' },
      body: JSON.stringify({ rows: [invalid, ahead, unknownExercise, workoutSet(at(-10))] }),
    })

    expect(pushResponseSchema.parse(await res.json()).results).toEqual([
      { status: 'rejected', reason: 'invalid', issues: ['reps'] },
      { status: 'rejected', reason: 'clock_skew', issues: ['updatedAt'] },
      { status: 'rejected', reason: 'unknown_exercise', issues: ['exerciseId'] },
      { status: 'applied' },
    ])
    // One line with counts and issue paths, never row values.
    const line = lines.findLast((entry) => entry.includes('"sync push"'))
    expect(JSON.parse(line ?? '{}')).toMatchObject({
      received: 4,
      applied: 1,
      ignored: 0,
      rejected: 3,
      rejectedIssues:
        'workoutSets.reps invalid, workoutSets.updatedAt clock_skew, workoutSets.exerciseId unknown_exercise',
    })
    expect(line).not.toContain(user)
  })

  it("accepts a set of the user's own exercise, sent in the same batch or earlier", async () => {
    const user = newUser()
    const exerciseId = uuidv7()
    const sameBatch = workoutSet(at(-10))
    sameBatch.row.exerciseId = exerciseId
    // The set comes first in the batch; exercises are applied first anyway.
    expect(await push(user, [sameBatch, customExercise(exerciseId)])).toEqual([
      'applied',
      'applied',
    ])

    const later = workoutSet(at(-5))
    later.row.exerciseId = exerciseId
    expect(await push(user, [later])).toEqual(['applied'])
    expect(await push(newUser(), [later])).toEqual(['rejected'])
  })

  it('pages a pull across tables in the order the rows were applied', async () => {
    const user = newUser()
    const exerciseId = uuidv7()
    await push(user, [workoutSet(at(-10)), customExercise(exerciseId), workoutSet(at(-9))])

    const first = await pullRows(db, user, 0, 2)
    expect(first.rows.map(({ table }) => table)).toEqual(['exercises', 'workoutSets'])
    expect(first.more).toBe(true)
    const second = await pullRows(db, user, first.cursor, 2)
    expect(second.rows.map(({ table }) => table)).toEqual(['workoutSets'])
    expect(second.more).toBe(false)
  })

  it('answers 400 to a body that is not a push request', async () => {
    const res = await app.request('/api/sync/push', {
      method: 'POST',
      headers: { ...headers(newUser()), 'content-type': 'application/json' },
      body: '{"rows": []}',
    })
    expect(res.status).toBe(400)
  })
})
