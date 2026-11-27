import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // A negative UTC offset with daylight saving: code that derives a day from a
    // UTC timestamp fails here instead of passing on a UTC+8 machine.
    env: { TZ: 'America/Los_Angeles' },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: [
            'apps/*/src/**/*.test.ts',
            'apps/*/evals/**/*.test.ts',
            'packages/*/src/**/*.test.ts',
          ],
          exclude: ['**/*.int.test.ts'],
        },
      },
      {
        // Needs Postgres: `pnpm db:up` locally, a service container in CI.
        extends: true,
        test: {
          name: 'integration',
          include: ['apps/*/src/**/*.int.test.ts'],
          globalSetup: ['apps/api/src/db/integration-setup.ts'],
        },
      },
    ],
  },
})
