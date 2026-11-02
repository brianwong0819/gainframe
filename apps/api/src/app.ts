import { Hono } from 'hono'

import { type HealthDeps, healthRoutes } from './routes/health.ts'

export type AppDeps = HealthDeps

// Dependencies are passed in so tests can run without a database.
export function createApp(deps: AppDeps) {
  // CloudFront forwards `/api/*` to the Lambda without stripping the prefix,
  // so every route is mounted under `/api`.
  return new Hono().basePath('/api').route('/health', healthRoutes(deps))
}
