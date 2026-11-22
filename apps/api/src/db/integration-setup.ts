// Vitest global setup for the integration project: migrates the test database
// once, before any test file runs. Files run in parallel, and two files
// migrating at the same time race on `CREATE SCHEMA IF NOT EXISTS` (L-040).
import { parseDatabaseUrl } from '../env.ts'
import { runMigrations } from './migrate.ts'

export default async function setup(): Promise<void> {
  await runMigrations(parseDatabaseUrl(process.env))
}
