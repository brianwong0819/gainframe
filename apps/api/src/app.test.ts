import { describe, expect, it } from 'vitest'

import { createApp } from './app.ts'

const reachable = () => Promise.resolve()
const unreachable = () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432'))

describe('GET /api/health', () => {
  it('reports the database as connected when it answers', async () => {
    const res = await createApp({ pingDatabase: reachable }).request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', database: 'connected' })
  })

  it('returns 503 when the database is unreachable', async () => {
    const res = await createApp({ pingDatabase: unreachable }).request('/api/health')

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'error', database: 'unreachable' })
  })

  it('returns 404 for an unknown route', async () => {
    const res = await createApp({ pingDatabase: reachable }).request('/api/unknown')

    expect(res.status).toBe(404)
  })
})
