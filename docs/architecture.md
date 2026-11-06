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
                 ├─ Neon Postgres (Drizzle over the `pg` driver)
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
    src/diagnostics/  client error log and Diagnostics data (the only code that records client errors)
    src/ui/           design-system primitives (Pressable, Sheet, NumberRoll, Ring…)
    src/styles/       tokens.css, globals
    src/pwa/          manifest colours, icon and splash rendering, service worker registration
    src/sw/           the service worker (Serwist); its own tsconfig with the WebWorker lib
    scripts/          build steps: render PWA images before `next build`, bundle the service worker after it
    messages/         i18n catalogs: zh.json, en.json
  api/                Hono on AWS Lambda
    src/routes/       one file per resource; thin: validate → call service → respond
    src/services/     business logic that needs the DB or AI
    src/db/           Drizzle schema, migrations, client
    src/ai/           the only place that talks to model providers (see docs/ai.md)
    src/log.ts        JSON-lines logger (the only code that writes to stdout/stderr)
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
| nudges | kind (reminder/plateau), rule, snapshot jsonb, analysis, model, prompt_version, sent_at, read_at |
| push_subscriptions | endpoint, keys |
| ai_usage | user_id, local_date, feature, calls, tokens (server-only; enforces daily caps) |

## Sync rules (details in ADR-0003, written in M0-14)

- Local first: every write goes to Dexie and an outbox row in one transaction.
- Push: batches of outbox rows; server upserts by `id`; **last writer wins on `updated_at`**; a `deleted_at` is just another update.
- Pull: by server cursor (monotonic `server_updated_at`), not by client clocks.
- Idempotent: re-sending the same batch is harmless.
- One user, few devices — no CRDTs, no merge UI.

## Observability

Goal: any problem bw sees on the phone can be traced to a log line in minutes, without logging personal data. No paid tools; everything sits in the CloudWatch and SNS free tiers.

- **API logs.** `apps/api/src/log.ts` writes one JSON object per line to stdout: `level`, `msg`, `requestId`, `release`, plus primitive fields. CloudWatch Logs Insights discovers JSON fields automatically, so no log library or Lambda log-format setting is needed. Levels: `error` (needs action; drives the alarm), `warn` (unexpected but handled, e.g. an AI retry), `info` (one access line per request, one line per AI call, sync push and job run). No `debug` level in deployed code.
- **Request ID.** The Lambda request ID (generated locally in dev) is attached to every line, returned as `x-request-id`, and included in error responses. The web app stores it with any failed request, so a Diagnostics entry leads straight to the server lines.
- **Errors.** Routes throw; `app.onError` maps known errors to the shared error shape and logs unknown ones once with their stack. Code never logs and rethrows the same error.
- **Never logged:** request or response bodies, query strings, headers (`Authorization` above all), images, user API keys, prompts or model output containing personal data, emails. `userId` is the opaque Cognito `sub`. The logger's primitive-only fields make whole objects impossible to log by accident.
- **Client errors.** `apps/web/src/diagnostics` records errors from the root error boundary, global `error` / `unhandledrejection` handlers and failed sync requests in a capped Dexie table, shown in Settings → Diagnostics (M1-11). From M2-08 they are also sent to `POST /api/client-errors`. Sentry stays out (cost, third-party data processor, one more account).
- **Release.** The git SHA (`RELEASE`) is stamped into the Lambda environment and the web bundle and appears on every log line and client error.
- **Alerts** (M2-08). A metric filter on `level=error` with an SNS email alarm (Lambda's `Errors` metric only counts crashes, not 500 responses), plus Lambda `Errors` and `Throttles` alarms. Retention 14 days dev, 30 days prod.
- **AI calls** are logged per call (see `docs/ai.md`); Bedrock model invocation logging stays off because it would store images and prompts.

## Known gotchas (verify, then record the outcome in an ADR)

- **CloudFront → Lambda Function URL auth** (decided in [ADR-0002](adr/0002-cloudfront-to-api-auth.md)): origin access control. CloudFront overwrites `Authorization`, so the client sends its token in `x-gainframe-token`, and every `PUT`/`POST` carries `x-amz-content-sha256`.
- **iOS PWA.** Background JS is suspended when locked; Web Push only works for home-screen apps after a user gesture; audio must be unlocked by a tap; OAuth redirects in standalone mode need testing.
- **Next.js static export** limits — see CLAUDE.md.
- **Service worker build.** Serwist's Next.js integrations need webpack (`@serwist/next`) or a route handler (`@serwist/turbopack`); neither fits a Turbopack static export. `scripts/build-sw.ts` instead bundles `src/sw/sw.ts` with rolldown after `next build` and injects the list of files in `out/` with `@serwist/build`. The worker precaches the whole export and caches nothing at runtime; `/api/*` always goes to the network. It does not call `skipWaiting`, so a release takes over only after every window of the previous one is closed.
- **Neon free tier** auto-suspends; the first query after idle is slower. Use the pooled connection string from Lambda. `GET /api/health` queries the database, so an external uptime check would keep the compute awake and spend free-tier compute hours.
- **Bedrock in ap-southeast-1** offers current Claude models only through `global.` cross-Region inference profiles, which may route requests to any commercial Region; `apac.` profiles exist only for older Claude 3.x models. Accepted for this project (no data-residency requirement). See "Bedrock model availability" in `docs/ai.md`. Model IDs live in config, never in code.

## Not in this architecture (on purpose)

API Gateway, containers in prod, RDS/Aurora, NAT gateway, ALB, DynamoDB, Sentry, TanStack Query, Redux, Turborepo, Testcontainers, Lottie, Sign in with Apple, any styled component library, self-trained models. Docker is used only for local Postgres and in CI.
