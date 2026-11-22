// `pnpm --filter @gainframe/api db:migrate`: applies pending migrations to the
// database in DATABASE_URL. The deploy runs it before the new code is live,
// so every migration is backward compatible (docs/infra.md).
import { parseDatabaseUrl, readRelease } from '../env.ts'
import { createLogger, errorFields } from '../log.ts'
import { runMigrations } from './migrate.ts'

const log = createLogger({ release: readRelease(process.env) })

try {
  await runMigrations(parseDatabaseUrl(process.env))
  log.info('migrations applied')
} catch (error) {
  log.error('migrations failed', errorFields(error))
  process.exitCode = 1
}
