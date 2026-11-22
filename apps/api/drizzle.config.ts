import { defineConfig } from 'drizzle-kit'

// `pnpm --filter @gainframe/api db:generate` writes a migration for each schema
// change; CI fails when the schema and the committed migrations disagree.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
})
