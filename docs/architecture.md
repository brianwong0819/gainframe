# Architecture

The approved shape of the system. Anything not described here needs bw's OK (and usually an ADR) before it is built.

## Overview

```
iPhone PWA (Next.js static export)
  ├─ UI reads/writes Dexie (IndexedDB)  ← source of truth on the device
  ├─ Sync engine: outbox → POST /api/sync/push, GET /api/sync/pull
  └─ Photos: PUT directly to S3 with a presigned URL
        │
CloudFront (one domain)
  ├─ /*      → S3 (static site, OAC)
  └─ /api/*  → Lambda Function URL (Hono, Node.js, zip)
                 ├─ Cognito JWT verification
                 ├─ Neon Postgres (Drizzle)
                 ├─ AI service layer → Bedrock (Claude) | Anthropic | OpenAI
                 └─ Web Push
EventBridge Scheduler → Lambda (weekly report, plateau check, one-off rest-timer push)
SSM Parameter Store (secrets) · CloudWatch (logs, alarms) · AWS Budgets
```

Region: `ap-southeast-1` for everything. Environments: `dev` (auto-deploy from `main`) and `prod` (manual approval). Neon uses branches `dev` and `prod`.

## Repository layout

```
apps/
  web/                Next.js (output: 'export'), React, Tailwind, Motion, Dexie, Serwist, next-intl, visx
    src/app/          routes (client components; static only)
    src/features/     one folder per feature: workout/, food/, today/, trends/, coach/, settings/
    src/db/           Dexie schema + repositories (the only code that touches IndexedDB)
    src/sync/         sync engine (the only code that calls /api/sync)
    src/ui/           design-system primitives (Pressable, Sheet, NumberRoll, Ring…)
    src/styles/       tokens.css, globals
    messages/         i18n catalogs: zh.json, en.json
  api/                Hono on AWS Lambda
    src/routes/       one file per resource; thin: validate → call service → respond
    src/services/     business logic that needs the DB or AI
    src/db/           Drizzle schema, migrations, client
    src/ai/           the only place that talks to model providers (see docs/ai.md)
    src/jobs/         scheduled handlers (weekly report, plateau check)
    prompts/          versioned prompt files
    evals/            eval runners + fixtures (photos are NOT committed)
packages/
  shared/             Zod schemas, inferred types, pure domain functions, config constants
    src/schemas/
    src/domain/       e1RM, volume, targets, moving averages, plateau & nudge rules
infra/
  bootstrap/          state bucket, GitHub OIDC, CI roles (applied once by bw)
  modules/            site, api, auth, storage, scheduler, monitoring
  envs/dev, envs/prod
docs/                 this folder
```

Dependency direction: `web` → `shared`, `api` → `shared`. `shared` depends on nothing but Zod. `web` and `api` never import each other.

## Data model

All synced tables: `id uuid` (client-generated UUIDv7), `user_id`, `created_at`, `updated_at`, `deleted_at`. Units: kg, g, kcal.

| Table | Key fields |
|---|---|
| profiles | phase (bulk/maintain/cut), protein_mode + value, kcal_target, default_rest_s, locale, timezone |
| body_metrics | local_date, weight_kg |
| exercises | name_zh, name_en, muscle, equipment, is_builtin, default_rest_s |
| templates / template_items | name; exercise_id, position, superset_group, target_sets, target_reps |
| workouts | started_at, ended_at, template_id, local_date, note |
| workout_sets | workout_id, exercise_id, superset_group, position, kind (warmup/working/drop/failure), weight_kg, reps, rpe, completed_at |
| meals / meal_items | eaten_at, local_date, meal_type, photo_key; name, grams, protein_g, kcal, source (ai/manual/frequent), ai_raw jsonb |
| weekly_summaries | week_start, stats jsonb, body, model, tokens_in, tokens_out |
| nudges | kind (reminder/plateau), rule, snapshot jsonb, analysis, sent_at, read_at |
| push_subscriptions | endpoint, keys |
| ai_usage | user_id, local_date, feature, calls, tokens (server-only; enforces daily caps) |

## Sync rules (details in ADR-0001)

- Local first: every write goes to Dexie and an outbox row in one transaction.
- Push: batches of outbox rows; server upserts by `id`; **last writer wins on `updated_at`**; a `deleted_at` is just another update.
- Pull: by server cursor (monotonic `server_updated_at`), not by client clocks.
- Idempotent: re-sending the same batch is harmless.
- One user, few devices — no CRDTs, no merge UI.

## Known gotchas (verify, then record the outcome in an ADR)

- **CloudFront → Lambda Function URL auth.** With OAC on a Function URL, POST/PUT bodies need an `x-amz-content-sha256` header from the client. The alternative is `AuthType NONE` + a secret custom header added by CloudFront and checked in Hono. Decide in M0-08.
- **iOS PWA.** Background JS is suspended when locked; Web Push only works for home-screen apps after a user gesture; audio must be unlocked by a tap; OAuth redirects in standalone mode need testing.
- **Next.js static export** limits — see CLAUDE.md.
- **Neon free tier** auto-suspends; the first query after idle is slower. Use the pooled connection string from Lambda.
- **Bedrock in ap-southeast-1** may only offer Claude via cross-region inference profiles (`apac.…` IDs). Model IDs live in config, never in code.

## Not in this architecture (on purpose)

API Gateway, containers in prod, RDS/Aurora, NAT gateway, ALB, DynamoDB, Sentry, TanStack Query, Redux, Turborepo, Testcontainers, Lottie, Sign in with Apple, any styled component library, self-trained models. Docker is used only for local Postgres and in CI.
