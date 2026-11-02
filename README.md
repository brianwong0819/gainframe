# gainframe

## Local development

Requires Node 24, pnpm (via Corepack) and Docker Desktop.

```
pnpm install
cp apps/api/.env.example apps/api/.env   # Windows: copy apps\api\.env.example apps\api\.env
pnpm db:up                                # Postgres 18 in Docker, waits until healthy
pnpm --filter api dev                     # http://localhost:8787/api/health
pnpm db:down                              # stop the database (data is kept in a Docker volume)
```

`pnpm check` runs lint, typecheck and unit tests. `pnpm test:integration` runs the tests that need the database (start it with `pnpm db:up` first). CI (`.github/workflows/ci.yml`) runs both, builds every app and scans the git history for secrets with gitleaks.
