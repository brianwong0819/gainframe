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
