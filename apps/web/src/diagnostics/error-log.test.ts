import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GainframeDb } from '../db/schema'

import { describeError, recentErrors, recordError } from './error-log'

let db: GainframeDb

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
})

afterEach(() => {
  db.close()
})

function entry(message: string) {
  return {
    source: 'error',
    message,
    stack: null,
    route: '/workout',
    release: 'test',
    at: '2026-11-09T02:00:00.000Z',
  } as const
}

describe('recordError', () => {
  it('stores the error, newest first', async () => {
    await recordError(db, entry('first'))
    await recordError(db, entry('second'))
    expect((await recentErrors(db)).map((error) => error.message)).toEqual(['second', 'first'])
  })

  it('keeps only the most recent errors up to the cap', async () => {
    for (const message of ['1', '2', '3', '4']) await recordError(db, entry(message), 3)
    expect((await recentErrors(db)).map((error) => error.message)).toEqual(['4', '3', '2'])
  })

  it('rejects an entry outside the schema', async () => {
    await expect(recordError(db, { ...entry('x'), route: 'workout?weight=80' })).rejects.toThrow()
    expect(await db.errors.count()).toBe(0)
  })
})

describe('describeError', () => {
  it('takes the message and stack of an Error', () => {
    const error = new TypeError('x is undefined')
    expect(describeError(error)).toEqual({ message: 'x is undefined', stack: error.stack })
  })

  it('describes a thrown non-Error value without a stack', () => {
    expect(describeError('offline')).toEqual({ message: 'offline', stack: null })
  })

  it('cuts long messages and stacks to the stored lengths', () => {
    const error = new Error('m'.repeat(600))
    error.stack = 's'.repeat(5000)
    const described = describeError(error)
    expect(described.message).toHaveLength(500)
    expect(described.stack).toHaveLength(4000)
  })
})
