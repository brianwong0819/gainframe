import { describe, expect, it } from 'vitest'

import { app } from './app.ts'

describe('GET /api/health', () => {
  it('reports the service as healthy', async () => {
    const res = await app.request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('returns 404 for an unknown route', async () => {
    const res = await app.request('/api/unknown')

    expect(res.status).toBe(404)
  })
})
