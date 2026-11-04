import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createLogger, errorFields } from './log.ts'

const lineSchema = z.record(z.string(), z.unknown())

function capture() {
  const lines: string[] = []
  const log = createLogger({ release: 'abc123', write: (line) => lines.push(line) })
  return { log, lines, parsed: () => lines.map((line) => lineSchema.parse(JSON.parse(line))) }
}

describe('createLogger', () => {
  it('writes one JSON object per line with level, msg and release', () => {
    const { log, lines, parsed } = capture()

    log.info('sync push', { received: 12, applied: 11 })

    expect(lines).toHaveLength(1)
    expect(lines[0]?.endsWith('\n')).toBe(true)
    expect(parsed()).toEqual([
      { level: 'info', msg: 'sync push', received: 12, applied: 11, release: 'abc123' },
    ])
  })

  it('adds the child fields to every line', () => {
    const { log, parsed } = capture()

    const child = log.child({ requestId: 'req-1' })
    child.warn('retrying')
    child.error('failed', { attempt: 2 })

    expect(parsed()).toEqual([
      { level: 'warn', msg: 'retrying', requestId: 'req-1', release: 'abc123' },
      { level: 'error', msg: 'failed', attempt: 2, requestId: 'req-1', release: 'abc123' },
    ])
  })

  it('does not let call-site fields overwrite level, msg, release or the request ID', () => {
    const { log, parsed } = capture()

    log
      .child({ requestId: 'req-1' })
      .info('real', { level: 'error', msg: 'fake', release: 'other', requestId: 'req-2' })

    expect(parsed()).toEqual([
      { level: 'info', msg: 'real', release: 'abc123', requestId: 'req-1' },
    ])
  })
})

describe('errorFields', () => {
  it('keeps the name, message and stack of an Error', () => {
    const fields = errorFields(new TypeError('bad input'))

    expect(fields).toMatchObject({ errorName: 'TypeError', errorMessage: 'bad input' })
    expect(fields.stack).toContain('bad input')
  })

  it('describes a thrown value that is not an Error', () => {
    expect(errorFields('plain string')).toEqual({
      errorName: 'string',
      errorMessage: 'plain string',
      stack: null,
    })
  })
})
