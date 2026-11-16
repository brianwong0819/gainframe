import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { checkDatabase, isDatabaseCheckEvent } from './database-check.ts'
import { createLogger } from './log.ts'

const lineSchema = z.record(z.string(), z.unknown())

function capture() {
  const lines: string[] = []
  const log = createLogger({ release: 'test-sha', write: (line) => lines.push(line) })
  const logs = () => lines.map((line) => lineSchema.parse(JSON.parse(line)))
  return { log, logs }
}

describe('isDatabaseCheckEvent', () => {
  it('accepts only the exact direct-invocation event', () => {
    expect(isDatabaseCheckEvent({ check: 'database' })).toBe(true)
    expect(isDatabaseCheckEvent({ check: 'database', rawPath: '/api/health' })).toBe(false)
    expect(isDatabaseCheckEvent({ check: 'other' })).toBe(false)
    expect(isDatabaseCheckEvent({ version: '2.0', rawPath: '/api/health' })).toBe(false)
  })
})

describe('checkDatabase', () => {
  it('reports the database as connected when it answers', async () => {
    const { log, logs } = capture()

    await expect(checkDatabase(() => Promise.resolve(), log)).resolves.toEqual({
      database: 'connected',
    })
    expect(logs()).toEqual([expect.objectContaining({ level: 'info', msg: 'database check' })])
  })

  it('reports it as unreachable and logs one error line when the ping fails', async () => {
    const { log, logs } = capture()
    const failing = () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432'))

    await expect(checkDatabase(failing, log)).resolves.toEqual({ database: 'unreachable' })
    const errors = logs().filter((line) => line.level === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      msg: 'database check failed',
      errorMessage: 'connect ECONNREFUSED 127.0.0.1:5432',
    })
  })
})
