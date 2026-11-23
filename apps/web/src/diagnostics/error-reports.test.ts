import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type ClientErrorReport, clientErrorReportSchema } from '@gainframe/shared'

import { type ApiClient, ApiRequestError, type ApiRequest } from '../api/client'
import { GainframeDb } from '../db/schema'

import { sendErrorReports } from './error-reports'

let db: GainframeDb
let reports: ClientErrorReport[]
let failWith: Error | undefined

const api: ApiClient = {
  request: (schema, request: ApiRequest) => {
    if (failWith !== undefined) return Promise.reject(failWith)
    const report = clientErrorReportSchema.parse(request.body)
    reports.push(report)
    return Promise.resolve(schema.parse({ received: report.errors.length }))
  },
}

beforeEach(() => {
  db = new GainframeDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
  reports = []
  failWith = undefined
})

afterEach(() => {
  db.close()
})

async function record(count: number) {
  for (let index = 0; index < count; index += 1) {
    await db.errors.add({
      source: 'error',
      message: `error ${String(index)}`,
      stack: null,
      route: '/workout',
      release: 'test',
      at: '2026-11-23T06:00:00.000Z',
    })
  }
}

describe('sendErrorReports', () => {
  it('sends recorded errors in batches of 20 and each one only once', async () => {
    await record(45)

    await expect(sendErrorReports(db, api)).resolves.toBe(45)
    expect(reports.map((report) => report.errors.length)).toEqual([20, 20, 5])
    expect(Object.keys(reports[0]?.errors[0] ?? {})).not.toContain('seq')

    await record(1)
    await expect(sendErrorReports(db, api)).resolves.toBe(1)
    expect(reports.at(-1)?.errors.map((error) => error.message)).toEqual(['error 0'])
  })

  it('keeps the errors for the next call when the report could not be sent', async () => {
    await record(2)
    failWith = new TypeError('Failed to fetch')
    await expect(sendErrorReports(db, api)).rejects.toThrow('Failed to fetch')

    failWith = undefined
    await expect(sendErrorReports(db, api)).resolves.toBe(2)
  })

  it('moves past a batch the API refuses, so a refusal cannot repeat on every backup', async () => {
    await record(2)
    failWith = new ApiRequestError(400, 'invalid_request', 'r-1')
    await sendErrorReports(db, api)

    failWith = undefined
    await expect(sendErrorReports(db, api)).resolves.toBe(0)
    expect(reports).toEqual([])
  })

  it('keeps the errors when the sign-in was refused', async () => {
    await record(1)
    failWith = new ApiRequestError(401, 'unauthorized', 'r-1')
    await expect(sendErrorReports(db, api)).rejects.toThrow()

    failWith = undefined
    await expect(sendErrorReports(db, api)).resolves.toBe(1)
  })
})
