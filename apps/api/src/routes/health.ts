import { Hono } from 'hono'

export interface HealthDeps {
  pingDatabase: () => Promise<void>
}

export function healthRoutes({ pingDatabase }: HealthDeps) {
  return new Hono().get('/', async (c) => {
    try {
      await pingDatabase()
      return c.json({ status: 'ok', database: 'connected' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(
        `${JSON.stringify({ level: 'error', msg: 'database health check failed', error: message })}\n`,
      )
      return c.json({ status: 'error', database: 'unreachable' }, 503)
    }
  })
}
