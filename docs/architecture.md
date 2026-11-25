# Architecture

The approved shape of the system. Anything not described here needs bw's OK (and usually an ADR) before it is built.

## Overview

```
iPhone PWA (Next.js static export)
  ├─ UI reads/writes Dexie (IndexedDB)  ← source of truth on the device
  └─ Sync engine: outbox → POST /api/sync/push, GET /api/sync/pull
     (meal photos go only to the estimate request; none is stored on the server)
        │
CloudFront (one domain)
  ├─ /*      → S3 (static site, OAC)
  └─ /api/*  → Lambda Function URL (Hono, Node.js, zip)
                 ├─ Cognito JWT verification
                 ├─ Neon Postgres (Drizzle over the `pg` driver)
                 ├─ AI service layer → Claude (Anthropic API; Bedrock when enabled)
                 └─ Web Push
EventBridge Scheduler → Lambda (weekly report, plateau check, one-off rest-timer push)
SSM Parameter Store (secrets) · CloudWatch (logs, alarms) · AWS Budgets
```

Region: `ap-southeast-1` for everything. Environments: `dev` (auto-deploy from `main`) and `prod` (manual approval). Neon uses the branch `dev` for dev and the root branch `production` for prod.

## Repository layout

```
apps/
  web/                Next.js (output: 'export'), React, Tailwind, Motion, Dexie, Serwist, next-intl, visx
    src/app/          routes (client components; static only)
    src/features/     one folder per feature: exercises/, plans/, workout/, history/, settings/ (later food/, today/, trends/, coach/)
    src/db/           Dexie schema + repositories (the only code that touches IndexedDB)
    src/auth/         sign-in with Cognito: PKCE, the redirect flow, token refresh and the session's shape (ADR-0007)
    src/api/          the API client: token and body-hash headers, refresh on demand, failures recorded for Diagnostics (ADR-0002)
    src/sync/         sync engine (the only code that calls /api/sync)
    src/diagnostics/  client error log and Diagnostics data (the only code that records client errors)
    src/ui/           design-system primitives and components used by two or more features (Pressable, Sheet, Stepper, ConfirmButton, SwipeRow…)
    src/styles/       tokens.css, globals
    src/pwa/          manifest colours, the mark, icon and splash rendering, launch screen, service worker registration
    src/sw/           the service worker (Serwist); its own tsconfig with the WebWorker lib
    src/csp/          the per-page inline-script hash policy added to the static export
    scripts/          build steps: render PWA images before `next build`; after it, add the hash policy, then bundle the service worker
    e2e/              Playwright tests over the static export (device layout matrix; critical flows from M1-12)
    messages/         i18n catalogs: zh.json, en.json
  api/                Hono on AWS Lambda
    src/routes/       one file per resource; thin: validate → call service → respond
    src/services/     business logic that needs the DB or AI
    src/db/           Drizzle schema, client, migration runner
    drizzle/          SQL migrations written by `drizzle-kit generate` (never edited by hand)
    src/ai/           the only place that talks to model providers (see docs/ai.md)
    src/log.ts        JSON-lines logger (the only code that writes to stdout/stderr)
    src/jobs/         scheduled handlers (weekly report, plateau check)
    prompts/          versioned prompt files
    evals/            eval runners + fixtures (photos are NOT committed)
packages/
  shared/             Zod schemas, inferred types, pure domain functions, config constants
    src/schemas/
    src/domain/       e1RM, volume, targets, moving averages, plateau & nudge rules
    src/food-table/   the bundled food table (`@gainframe/shared/food-table`): source extracts in sources/, their curation, the table built from them
infra/
  bootstrap/          state bucket, GitHub OIDC, CI roles (applied once by bw)
  modules/            site, api, auth, storage, scheduler, monitoring
  envs/dev, envs/prod
docs/                 this folder
```

Dependency direction: `web` → `shared`, `api` → `shared`. `shared` depends on nothing but Zod. `web` and `api` never import each other.

## Data model

All synced tables: `id uuid` (client-generated UUIDv7), `user_id`, `created_at`, `updated_at`, `deleted_at`; on the server also `server_version`, and the server-only `sync_state` table holds each user's last `server_version` (`apps/api/src/db/schema.ts`); the server-only `deleted_users` table keeps the `sub` of each deleted account, so a push from a token issued before the deletion is refused. Units: kg, g, kcal (a weight shown in pounds is converted when typed and when shown). `weekly_summaries` and `nudges` are written by the server and only pulled; `push_subscriptions` and `ai_usage` are not synced.

| Table | Key fields |
|---|---|
| profiles | protein_mode (fixed) + protein_value, kcal_target (M3-02, the daily targets set from the Food tab); sex, birth_year, height_cm, activity_level (sedentary/light/moderate/high/veryHigh), phase (bulk/maintain/cut), all nullable, for the target calculator (M4-01, sync version 4); the g/kg protein mode follows with M4-01's remaining parts; later default_rest_s, locale, timezone. One per user in meaning; the device reads the most recently updated row (ADR-0003). Sync version 3 added it |
| body_metrics | measured_at, local_date, weight_kg, body_fat_pct, skeletal_muscle_kg, fat_mass_kg (the last three nullable), source (manual/scan/health). Sync version 4 added it; the target calculator writes the first row |
| exercises | name_zh, name_en, muscle, equipment, default_rest_s (custom exercises only; built-ins are the constant `BUILT_IN_EXERCISES` in `packages/shared/src/built-in-exercises.ts` with fixed IDs) |
| plans / plan_days / plan_items | name; plan_id, name, position (the rotation order); plan_id, plan_day_id, exercise_id, position, superset_group, target_sets, reps_min, reps_max, rest_s, note (no weight; which plan is active is a device setting, not a column; the members of a superset share one target_sets, its rounds, and one rest_s, taken after each round) |
| workouts | started_at, ended_at, plan_day_id (the plan day followed, if any), local_date, note, rest_started_at, rest_ends_at (the rest in progress, so a relaunch shows it) |
| workout_exercises | workout_id, exercise_id, position, superset_group, note, plan_note (copied from the plan item), reps_min, reps_max, rest_s (one exercise slot in a workout, mirroring plan_items; a slot started from a plan copies the item's rep range and rest, all null for an exercise added by hand; the members of a superset share one rest_s; the same exercise may take two slots) |
| workout_sets | workout_exercise_id, workout_id, exercise_id (both copied from the slot at creation, never changed), position (within the slot), kind (warmup/working/drop/failure), weight_kg, reps, rpe, completed_at |
| meals / meal_items | eaten_at, local_date, meal_type (breakfast/lunch/dinner/snack), name (the dish name a model gave, else null), photo_key (always null: photos are not stored on the server, bw 2026-11-24); meal_id, position, name, grams, protein_g, kcal (for the portion eaten), source (ai/manual/frequent/table; sync version 5 added table), ai_raw jsonb (the model's own estimate of the item before correction). A meal's figures are the sum of its live items (`nutritionTotals`); deleting a meal soft-deletes its items. Sync version 2 added both tables |
| foods | table_id (the food table entry this row edits, else null for the user's own food), name, protein_per100_g, kcal_per100_g, servings jsonb (`[{ label, grams }]`, the first is the one a tap adds). An edit replaces its entry for the user wherever the table is read (`foodLibrary`); deleting it restores the entry; the device keeps the latest edit per entry. Meal items copy a portion's figures, so an edit never changes a logged meal. Sync version 6 added it (M3-12) |
| weekly_summaries | week_start, stats jsonb, body, model, tokens_in, tokens_out |
| nudges | kind (reminder/plateau), rule, snapshot jsonb, analysis, model, prompt_version, sent_at, read_at |
| push_subscriptions | endpoint, keys |
| ai_usage | user_id, day (UTC date, so a client cannot reset its cap by sending another date), feature, calls, input_tokens, output_tokens (server-only; a call is counted before it is made, which enforces the daily cap) |

Device-only Dexie tables, never synced or exported: `outbox`, `errors`, `settings`, and `pendingPhotos` (M3-03): a meal photo taken offline (the shrunk JPEG as base64, time, day, meal type) with its estimate once the app is online again; confirming it logs the meal and deletes the row in one transaction (`src/db/pending-photos.ts`, `src/features/food/photo-queue.ts`).

## Sync rules (details in [ADR-0003](adr/0003-data-model-and-sync.md))

- Local first: every write goes to Dexie and an outbox row in one transaction.
- Push: batches of outbox rows; server upserts by `id`; **last writer wins on `updated_at`** (row level; equal or older is ignored, too far in the future is rejected); a `deleted_at` is just another update. `user_id` comes from the JWT, never the payload.
- Pull: by a per-user `server_version` counter assigned under a per-user lock, not by any clock.
- Idempotent: re-sending the same batch is harmless.
- One user, few devices — no CRDTs, no merge UI.
- On the device (`apps/web/src/db`): `GainframeDb` is the Dexie schema; `createRepositories` gives each synced table `get` / `create` / `update` / `remove`. A repository validates the row with its schema from `packages/shared`, sets `id` (UUIDv7 from `id.ts`), `createdAt`, `updatedAt` and `deletedAt`, and adds an `outbox` entry `{ seq, table, rowId }` in the same transaction. `updatedAt` always moves forward, by 1 ms past the stored value if the device clock went back, so the server never ignores a local edit as "equal or older". `remove` soft-deletes the row and its children (a workout's slots and sets, a slot's sets, a plan's days and items, a day's items). Features read through the repositories or their own queries inside `src/db`, never through IndexedDB directly.

## Security headers

CloudFront adds the same response headers policy (`infra/modules/site`) to every response, the API's included: `Content-Security-Policy`, `Strict-Transport-Security` (two years, subdomains, no preload on the default `*.cloudfront.net` name), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: same-origin`.

- **Content-Security-Policy.** The header is built from `infra/modules/site/content-security-policy.txt`, one directive per line; everything is `'self'`, plugins are off, `<base>` is forbidden and no site may frame the app. A static export renders the React Server Components payload and the Turbopack bootstrap as inline scripts, and no request exists to give them a nonce, so the header must allow `'unsafe-inline'` scripts. `scripts/csp-hashes.ts` closes that gap after `next build`: each page gets a `<meta>` policy `script-src 'self' 'sha256-…'` with the hashes of its own inline scripts. The browser enforces both policies, so only those scripts run. Inline styles stay allowed (React `style` attributes, the Next.js error page); they cannot run code.
- **Adding an origin.** A feature that talks to another origin adds it to the policy file in the same PR: Cognito's token endpoint (M2-02) under `connect-src` as `https://*.auth.ap-southeast-1.amazoncognito.com`, which covers every environment's prefix domain (managed login is a top-level navigation, which the policy does not restrict, and its forms are governed by Cognito's own policy), and nothing for photos: the estimate request is same-origin and the previews are `data:` URLs, which `img-src` already allows.
- **Zod.** Zod tries `new Function` whenever a `z.object()` is created, which the policy blocks and the browser reports as a violation. `src/zod-config.ts` sets `z.config({ jitless: true })` and is the first import of `src/instrumentation-client.ts`, which Next.js runs before the rest of the client code (a module imported before it could build a schema first); the server keeps the faster compiled parsers.
- **Tests.** The e2e server (`apps/web/e2e/serve.ts`) sends the same header from the same file, and `e2e/csp.spec.ts` fails on any policy violation on every device in the matrix.

## Routing

The static export writes each page as a file (`/workout` becomes `workout.html`), and S3 knows nothing about routes. A CloudFront Function on viewer requests to the site (`infra/modules/site/route-function.js`) maps a known route to its file, with or without a trailing slash, passes any path with a file extension through, and serves `404.html` for anything else (with status 200; the function cannot fetch a body to send a 404 itself). It knows the routes from `infra/modules/site/routes.json`, `pages` everywhere and `devPages` only where the module sets `dev_pages`; `apps/web/src/app/routes.test.ts` fails when the file and the pages under `src/app` disagree. A distribution-wide custom error response is not used: it would also replace API errors with the site's 404 page. The function is not attached to `/api/*`. The e2e server (`apps/web/e2e/serve.ts`) runs the same function, so tests route requests as CloudFront does.

## Languages

Chinese and English, with catalogues in `apps/web/messages/` (`zh.json`, `en.json`; the English one types every key). A static export has no request and no middleware to choose a language, so i18n runs on the client: `src/i18n/i18n-provider.tsx` wraps the app in next-intl's `NextIntlClientProvider` (no next-intl plugin or `i18n/request.ts`), the build prerenders Chinese, and after hydration the page switches to the device's choice (`localStorage`, else the first of `navigator.languages` the app speaks, else Chinese) and sets `<html lang>`. In the installed app the launch screen covers that first frame. Components that show text are client components using `useTranslations`. `src/i18n/catalog.test.ts` fails when the catalogues' keys differ or Chinese text appears in application code. The choice moves to the synced profile (`profiles.locale`) in M2.

## Observability

Goal: any problem bw sees on the phone can be traced to a log line in minutes, without logging personal data. No paid tools; everything sits in the CloudWatch and SNS free tiers.

- **API logs.** `apps/api/src/log.ts` writes one JSON object per line to stdout: `level`, `msg`, `requestId`, `release`, plus primitive fields. CloudWatch Logs Insights discovers JSON fields automatically, so no log library or Lambda log-format setting is needed. Levels: `error` (needs action; drives the alarm), `warn` (unexpected but handled, e.g. an AI retry), `info` (one access line per request with the route pattern, status, duration and the verified `userId` or null, one line per AI call, sync push and job run). No `debug` level in deployed code.
- **Request ID.** The Lambda request ID (generated locally in dev) is attached to every line, returned as `x-request-id`, and included in error responses. The web app stores it with any failed request, so a Diagnostics entry leads straight to the server lines.
- **Errors.** Routes throw; `app.onError` maps known errors to the shared error shape and logs unknown ones once with their stack. Code never logs and rethrows the same error.
- **Never logged:** request or response bodies, query strings, headers (`Authorization` above all), images, user API keys, prompts or model output containing personal data, emails. `userId` is the opaque Cognito `sub`. The logger's primitive-only fields make whole objects impossible to log by accident.
- **Client errors.** `apps/web/src/diagnostics` records errors from the root error boundaries (`app/error.tsx`, and `app/global-error.tsx` when the root layout itself fails), global `error` / `unhandledrejection` handlers (registered in `src/instrumentation-client.ts`, before the app's code runs) and failed sync requests in the Dexie table `errors` (schema version 2), capped at the latest 200, shown in Settings → Diagnostics (`/settings/diagnostics`, with a copy button for the whole log). An entry is `clientErrorSchema` from `packages/shared`: source, message (500 characters at most), stack (4,000), the path without its query string, release and time. A boundary records its error once; the global handlers see only what no boundary caught. If recording fails, the error is dropped rather than reported again, which could loop. On a signed-in device they are also sent to `POST /api/client-errors` after each successful backup (`src/diagnostics/error-reports.ts`, at most 20 per request, each entry once), which logs each one with `source: web` and the token's `userId`: a crash as `error`, so it reaches the alarm, and a failed request as `warn`, since the server logged its side already. Sentry stays out (cost, third-party data processor, one more account).
- **Release.** The git SHA (`RELEASE`) is stamped into the Lambda environment and the web bundle and appears on every log line and client error.
- **Alerts** (M2-08, `infra/modules/monitoring`). A metric filter on `level=error` in the API and pre sign-up log groups with an SNS email alarm (Lambda's `Errors` metric only counts crashes, not 500 responses), plus Lambda `Errors` and `Throttles` alarms on the API; the owner subscribes the email by hand. Saved Logs Insights queries per environment: by request ID, errors, slowest routes. Runbook: [debugging.md](debugging.md). Retention 14 days dev, 30 days prod.
- **AI calls** are logged per call (see `docs/ai.md`); Bedrock model invocation logging stays off because it would store images and prompts.

## Known gotchas (verify, then record the outcome in an ADR)

- **CloudFront → Lambda Function URL auth** (decided in [ADR-0002](adr/0002-cloudfront-to-api-auth.md)): origin access control. CloudFront overwrites `Authorization`, so the client sends its token in `x-gainframe-token`, and every `PUT`/`POST` carries `x-amz-content-sha256`.
- **iOS PWA.** Background JS is suspended when locked; Web Push only works for home-screen apps after a user gesture; audio must be unlocked by a tap; OAuth redirects in standalone mode need testing.
- **Next.js static export** limits — see CLAUDE.md.
- **Service worker build.** Serwist's Next.js integrations need webpack (`@serwist/next`) or a route handler (`@serwist/turbopack`); neither fits a Turbopack static export. `scripts/build-sw.ts` instead bundles `src/sw/sw.ts` with rolldown after `next build` and injects the list of files in `out/` with `@serwist/build`. The worker precaches the whole export and caches nothing at runtime; `/api/*` always goes to the network. It does not call `skipWaiting` on its own, so a release takes over only after every window of the previous one is closed, or when the user taps "Update" on Today: `src/pwa/update.ts` notices the waiting worker (also checking on each return to the foreground), posts Serwist's `SKIP_WAITING` message and reloads on `controllerchange`. The prompt is hidden while a workout is in progress.
- **Neon free tier** auto-suspends; the first query after idle is slower. Use the pooled connection string from Lambda. An external caller that queries the database keeps the compute awake and spends free-tier compute hours, so the public `GET /api/health` never touches it; the database check runs only when the function is invoked directly with `{ "check": "database" }`, which needs `lambda:InvokeFunction` (`apps/api/src/database-check.ts`). The deploy smoke test invokes it with the apply role.
- **Claude**: the API calls Claude through Anthropic's API while Bedrock does not offer Claude Haiku 5.5 to the account ([ADR-0008](adr/0008-anthropic-api-provider.md)); Bedrock's Messages API endpoint (`bedrock-mantle`), which in ap-southeast-1 routes requests globally, stays as the other provider. Neither keeps data in one Region; accepted for this project (no data-residency requirement). See "Providers" in `docs/ai.md`. Model IDs live in config, never in code.

## Not in this architecture (on purpose)

API Gateway, containers in prod, RDS/Aurora, NAT gateway, ALB, DynamoDB, Sentry, TanStack Query, Redux, Turborepo, Testcontainers, Lottie, Sign in with Apple, any styled component library, self-trained models. Docker is used only for local Postgres and in CI.
