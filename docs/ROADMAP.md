# Gainframe roadmap

The single task list. Product scope lives in the [plan document](https://claude.ai/artifact/RgNpVnYBw26jVjvPhPCMaD); this file covers what to build, in which order, and how to verify each step.

Rules:
- One task = one branch = one PR. The task ID goes in the branch name and PR title, e.g. `m1/05-set-logger`, `feat(workout): set logger [M1-05]`.
- Work in order. To skip ahead or insert a task, add a line here first and say why.
- Every task has a **Verify** step that the owner can check by hand — not just "tests pass".
- When a task is done, tick it and update [STATUS.md](STATUS.md).
- 👤 marks tasks the owner must do personally (accounts, billing, on-device testing); Claude provides the steps.

Estimates assume 10–15 hours a week. Daily gym use from week 5, MVP in week 16, portfolio complete in week 18.

---

## M0 Foundation (weeks 1–2)

Done when: every push to `main` deploys to dev automatically, and the rest-timer prototype holds up on an iPhone at the gym.

- [x] **M0-01 Repository rules**: CLAUDE.md, this roadmap, architecture and convention docs, PR template, `.gitattributes`, `.gitignore`.
  Verify: the owner has read CLAUDE.md and ROADMAP and agrees with every rule.
- [x] **M0-02 👤 Local toolchain**: move the repo out of OneDrive; install Node, pnpm, Docker Desktop, Terraform, AWS CLI, gh, Claude Code and the recommended plugins. Steps in [setup-windows.md](setup-windows.md).
  Verify: `node -v`, `pnpm -v`, `docker run hello-world`, `terraform -v`, `aws --version`, `gh auth status` all succeed.
- [x] **M0-03 👤 AWS account security**: MFA on the sign-in identity; activate advanced features so the account can use `ap-southeast-1` ([ADR-0001](adr/0001-aws-account-model.md)); allow `ap-southeast-1` in the Region SCP; `aws login` for short-lived CLI credentials; Budgets alerts at USD 1 and 5 (credits excluded) plus forecast; Cost Anomaly Detection; submit Anthropic use-case details in Bedrock and record the available inference profile IDs in `docs/ai.md`.
  Verify: after `aws login`, `aws sts get-caller-identity` returns the workload account role and `aws ec2 describe-availability-zones` lists `ap-southeast-1` zones; the Bedrock playground in `ap-southeast-1` answers a prompt with Claude.
- [x] **M0-04 Monorepo skeleton**: pnpm workspaces (`apps/web`, `apps/api`, `packages/shared`, `infra`); shared strict TypeScript config; ESLint + Prettier; Vitest; a root `pnpm check` that runs lint, typecheck and tests; a Claude Code hook in `.claude/settings.json` that runs Prettier and ESLint after every edit. Pin the newest Node major supported by Lambda in `.nvmrc` and `engines`. `web` is an empty Next.js static export; `api` is a Hono app with `/health` and a unit test.
  Verify: on a fresh clone, `pnpm install && pnpm check && pnpm build` pass; `pnpm --filter web dev` serves the page.
- [x] **M0-05 Local database**: `docker-compose.yml` with Postgres (same major as Neon); `.env.example`; `pnpm db:up` / `db:down`.
  Verify: after `pnpm db:up`, `pnpm --filter api dev` and `/health` reports the database as connected.
- [x] **M0-06 CI**: GitHub Actions on every PR: install, lint, typecheck, test (Postgres service container), build; pnpm cache; gitleaks secret scanning (CI fails if a secret or account ID is committed). Unit tests run with `TZ=America/Los_Angeles` (a negative offset with daylight saving) so code that derives a day from a UTC timestamp fails in CI, not on bw's UTC+8 machine. 👤 Owner enables branch protection on `main` (PR required, CI must pass) and Dependabot alerts + security updates (Settings → Code security; free).
  Verify: a PR with a deliberate type error turns CI red; fixing it turns it green.
- [x] **M0-07 Terraform bootstrap**: `infra/bootstrap` with the state bucket (versioned, encrypted, S3 native locking, no DynamoDB), the GitHub OIDC provider and two IAM roles (read-only plan role for PRs, apply role for `main`). 👤 Applied once locally by the owner.
  Verify: `terraform plan` shows no changes; both roles exist and their trust policy only allows this repository.
- [x] **M0-08 dev infrastructure**: `infra/envs/dev` plus reusable `infra/modules`: S3 site bucket + CloudFront (OAC), Lambda (zip) + Function URL, CloudFront routing `/api/*` to Lambda, SSM parameters, 14-day log retention, `project=gainframe` / `env=dev` tags. Settle the CloudFront → Function URL auth approach first (see "Known gotchas" in architecture.md) and record it as an ADR. Bundle the API into a single file for the zip. 👤 Owner creates the Neon project with its `dev` branch (moved forward from M2-01 so `/api/health` can reach a database) and applies dev once by hand, since CD arrives in M0-10.
  Verify: the CloudFront domain serves the empty page and `/api/health` returns `ok`; the raw Function URL rejects direct calls.
- [x] **M0-09 API logging and error handling**: the observability baseline, before anything real is deployed (design in "Observability" in [architecture.md](architecture.md)). `apps/api/src/log.ts`: a small JSON-lines logger, no new dependency, whose fields accept primitives only, so a request, header or body object cannot be logged whole. Request-ID middleware: use the Lambda request ID when present, otherwise generate one; return it as `x-request-id`. One access line per request (method, route pattern, status, duration; no query string, no body). `app.onError` and `app.notFound` return the shared error shape `{ error: { code, message, requestId } }`; unexpected errors are logged once, with stack. Replace the ad hoc `process.stderr.write` calls in `db/client.ts` and `routes/health.ts`. ESLint: `no-restricted-properties` on `process.stdout.write` / `process.stderr.write` outside the logger. `RELEASE` (git SHA) read from env and included in every line.
  Verify: tests prove an unexpected throw returns 500 in the shared shape with a request ID and logs one error line, and that an `Authorization` header never appears in log output. The CloudWatch check moved to M0-10, the first deploy that ships this code.
- [x] **M0-10 CD**: PRs get an automatic `terraform plan` comment; merging to `main` builds, applies dev, uploads the site to S3 and invalidates CloudFront. The build stamps the git SHA as `RELEASE` into the Lambda environment and the web bundle, so every log line and client error names the exact version. The API must be built before `terraform plan` (the `api` module zips `apps/api/dist/lambda`). CI assumes `gainframe-ci-plan` (PRs) and `gainframe-ci-apply` (`main`) by building the ARN from an `AWS_ACCOUNT_ID` secret; add `terraform fmt -check` and `terraform validate` to CI. If a job uses a GitHub Environment, its OIDC `sub` becomes `repo:…:environment:<name>` and the apply role's trust policy in `infra/bootstrap` must list it. If plans read SSM `SecureString` parameters, the plan role needs `kms:Decrypt` on the `aws/ssm` key (`ReadOnlyAccess` lacks it).
  Verify: a one-line text change is live on dev within 10 minutes of merging; the PR shows the plan comment; the `x-request-id` from `curl -i /api/health` on dev finds the access line in CloudWatch Logs Insights, and that line's `release` is the merged SHA.
- [x] **M0-11 Design tokens and motion foundation**: port the prototype's colours, type, spacing, radii and three springs into `apps/web/src/styles/tokens.css` and the Tailwind theme; self-host Martian Mono; `motion` presets (std / pop / soft / press); `<Pressable>` (0.96 press with spring release); reduced-motion fallback; a dev-only `/dev/kitchen-sink` page showing every token and animation. Spec: [design-system.md](design-system.md).
  Verify: on an iPhone, the kitchen sink switches correctly between light and dark and the press feedback matches the prototype; with Reduce Motion on, only fades remain.
- [x] **M0-12 PWA shell**: manifest, icons, splash screen, safe areas; Serwist precaches the app shell; opening offline shows the app, not a browser error.
  Verify: 👤 "Add to Home Screen" in iPhone Safari opens full-screen; it still opens in airplane mode.
- [x] **M0-13 👤 Rest-timer field test**: a standalone page with a rest countdown, Wake Lock, and an audio cue (unlocked by a tap, as iOS requires). The owner uses it at the gym 2–3 times.
  Verify: findings recorded in [ADR-0005](adr/0005-ios-rest-timer.md) (behaviour when locked, when switching apps, during a call). Done 2026-11-07; a call was not tested (locking produced the same audio interruption).
- [x] **M0-14 ADRs and board**: [ADR-0003](adr/0003-data-model-and-sync.md) data model and sync rules, [ADR-0004](adr/0004-pwa-over-native.md) PWA over native ([ADR-0005](adr/0005-ios-rest-timer.md), iOS timer limits and the three-layer fallback, was written in M0-13; ADR-0001 is the AWS account model, ADR-0002 the CloudFront to API auth). Create M1 issues and a GitHub Projects board with `gh`.
  Verify: ADR-0001 to ADR-0005 in `docs/adr/`; every M1 task is on the board.
  Done 2026-11-08: M1 issues #26–#38 (label `M1`). The board needs the `project` scope on bw's `gh` sign-in, so bw creates it with the commands under "Blocked on bw" in [STATUS.md](STATUS.md).

## M1 Workout logging + rest timer (weeks 3–5, local data only)

Done when: a full week of training is logged only in Gainframe, at ≤ 5 seconds per set.

- [x] **M1-01 Workout domain model**: Zod schemas in `packages/shared` (exercise, template, workout, set) and pure functions: estimated 1RM (Epley), volume, previous performance for an exercise, PR detection, and `toLocalDate(instant, timeZone)`, the only way code turns an instant into a `local_date`. Unit tests cover edge cases (0 reps, warm-up and drop sets never count as PRs; a set at 23:30 and 00:30 local time, and a daylight-saving change, land on the right day). Enable ESLint `@typescript-eslint/switch-exhaustiveness-check` with the first union type (set kind), so a new enum value cannot be silently unhandled.
  Verify: `pnpm test` passes; every test case reads clearly.
- [x] **M1-02 Local database layer**: Dexie schema v1; per-table repositories; client-generated UUIDv7; automatic `created_at` / `updated_at`; soft delete; an outbox entry written in the same transaction as every change (pushed from M2); `navigator.storage.persist()` requested on first launch. Rows and outbox follow [ADR-0003](adr/0003-data-model-and-sync.md) (built-in exercises are not rows; `user_id` stays null until M2-06). Tested with fake-indexeddb. Later schema versions each add an upgrade test (see "Tests" in [conventions.md](conventions.md)).
  Verify: tests pass; written rows appear in DevTools → IndexedDB.
- [x] **M1-03 App shell and navigation**: three tabs (Today / Workout / Food), icon transitions, page transitions (View Transitions; removed after the iPhone check at bw's request, tabs switch at once), next-intl zh/en switching (confirm the static-export approach first). A CloudFront Function in `infra/modules/site` maps routes to the exported files (`/workout` → `/workout.html`) and unknown paths to `404.html`; not a distribution-wide custom error response, which would also rewrite API errors. A root error boundary shows a recoverable error screen instead of a blank page; it and global `error` / `unhandledrejection` handlers (registered in `src/instrumentation-client.ts`, which runs before the app code) record errors in `src/diagnostics`: a Dexie table capped at the last 200 entries (message, stack, route, release, time; never form values or tokens). The table is Dexie schema version 2, so it brings the first upgrade test. Ships as three PRs (each under the size limit): route function, shell and i18n, then diagnostics.
  Verify: tab switching is smooth on an iPhone; in English mode no hard-coded Chinese remains.
- [x] **M1-04 Exercise library**: ~60 built-in exercises (zh/en names, aliases, primary and secondary muscles, equipment, compound or isolation, default rest) as a constant in `packages/shared` with fixed UUIDs ([ADR-0003](adr/0003-data-model-and-sync.md)); search; create and edit custom exercises; an exercise detail sheet with a muscle map (one front-and-back body drawn in SVG with design tokens, primary muscles strong and secondary muscles light; no photos, which would be inconsistent and carry licence risk) and 2–3 form cues per built-in exercise. Shipped as five PRs to stay under the size limit: catalog and search, library screen, custom exercise sheet, muscle map and detail, form cues.
  Verify: "卧推" and "bench" both find bench press; a custom exercise survives an app restart; the detail sheet of bench press highlights the chest, with triceps and shoulders lighter, in light and dark.
- [ ] **M1-05 Active workout + set logging**: start an empty workout and add exercises; each set row shows and pre-fills last time's numbers; weight/rep steppers; set types (warm-up / working / drop / failure), RPE, notes; completion check animation and rolling digits. iOS may end a backgrounded home-screen app at any time, so each set is written to Dexie when it is completed, not when the workout finishes; on launch an unfinished workout (`endedAt` null) is resumed, and at most one workout is in progress. Settle before building: how exercise order within a workout is stored (set `position` per workout or per exercise) and where per-exercise notes live (the set schema has no note field). For bodyweight exercises, `weightKg` holds the added load (0 = bodyweight only; the set row labels it so).
  Verify: one-handed, a set is logged in ≤ 5 seconds; a page reload loses nothing.
- [ ] **M1-06 Rest timer**: completing a set starts a countdown using the exercise's default; ±15 s; the sheet collapses to a pill; Wake Lock; audio cue that repeats until tapped to dismiss. The rest end time is persisted (with the active workout), so a relaunch after iOS ends the app shows the right remaining or overdue time. Follows layers 1 and 2 of [ADR-0005](adr/0005-ios-rest-timer.md): remaining time is always computed from the end time; on return from the background, a stale scheduled cue is cancelled and an overdue rest shows how long ago it ended. Settle the audio session type against the silent switch and the user's music.
  Verify: complete a set → sheet rises → drag to pill → cue plays on time (error < 1 s) and repeats until dismissed; lock the phone past the end, unlock → overdue state shows at once and no late cue plays.
- [ ] **M1-07 Supersets**: group two or more exercises and alternate; rest starts only after a full round.
  Verify: three rounds of A1/A2 start the timer only at the end of each round.
- [ ] **M1-08 Finish workout + summary**: duration, volume, PRs (estimated 1RM, plus a rep record, more reps at the same or higher weight, so sets above `e1rmMaxReps` can still be records; for bodyweight exercises, whose e1RM is meaningless at 0 kg added load, only the rep record applies; both rules are pure functions in `packages/shared/src/domain` with tests). Volume of a bodyweight set counts only the added load until body weight exists (M4-02), then adds the latest body weight; the three celebration tiers (chalk / plates / ripple) with their timing rules.
  Verify: a PR triggers the plates and the "New PR" tag; a normal set shows only chalk.
- [ ] **M1-09 Templates**: create from scratch, save a finished workout as a template, start from a template. Each template item can set its own rest between sets (nullable `restS` on the item; empty means the exercise's default), and a "Suggest" button fills it from a pure rule in `packages/shared/src/domain` based on the exercise's mechanic and the item's target reps (thresholds in config, no model call). The rest timer (M1-06) then takes the item's rest, else the exercise's default. A user can keep several templates, and exactly one is active (the current plan: a nullable `activeTemplateId` in local settings, not a flag on every row, so two devices cannot both mark one active); the Workout tab offers the active plan first. The exercise detail sheet gets "Add to plan", which lists the templates (active first) and appends the exercise to the chosen one.
  Verify: starting "Push A" restores exercise order, target sets and each exercise's rest; making "Pull B" active makes "Push A" inactive; "Add to plan" from bench press's detail appends it to the chosen template; "Suggest" gives a 5-rep squat a longer rest than a 15-rep lateral raise.
- [ ] **M1-10 History**: workout list, workout detail, edit or delete past sets (swipe to delete). Past workouts show the names of exercises deleted since (the repositories' `get` hides deleted rows, so history reads exercises including tombstones).
  Verify: editing a past set's weight updates "last time" in the next workout.
- [ ] **M1-11 Diagnostics and data export**: bw has no Mac, so Safari Web Inspector cannot attach to the iPhone; the app must show its own errors. Settings (which also takes over the language switch from Today) → Diagnostics shows release, storage-persisted status, recent errors with a copy button, and "Export all data (JSON)" as a backup while data lives only on the device. Also an "update available" prompt: without `skipWaiting` a new release reaches the installed app only after every window of the old one is closed (STATUS follow-up from M0-12); the prompt never reloads during a workout in progress.
  Verify: a dev-only "throw" button produces an entry that survives a reload; the exported JSON re-imports in a test.
- [ ] **M1-12 End-to-end test**: Playwright (already set up for the device layout tests in `apps/web/e2e`) at iPhone viewport: offline start → log 3 sets → finish → visible in history. Runs in CI.
  Verify: green in CI; deliberately breaking set logging turns it red.
- [ ] **M1-13 👤 Field week**: the owner logs every session in Gainframe for a week; problems become issues (with the copied Diagnostics entry), severe ones fixed that week.
  Verify: the week's sessions are in history; the issue list is the bug list.

## M2 Accounts and sync (weeks 6–7)

Done when: signing in on a second device shows all data.

- [ ] **M2-01 Neon + Drizzle**: 👤 owner adds the Neon `prod` branch (the project and `dev` exist since M0-08); connection strings in SSM. Drizzle schema mirrors Dexie; `drizzle-kit generate` migrations; deploys migrate dev automatically (a step in `deploy.yml` before `terraform apply`, reading the connection string from SSM with the apply role). The pool sets `statement_timeout` so a stuck query fails with a logged error instead of running until the Lambda timeout. Migrations run before the new code is live, so each one is backward compatible (expand, then contract in a later release). Drizzle tables repeat the column list of the shared Zod schemas, so a test checks that both name the same fields. `exercise_id` has no foreign key (built-in exercises are constants, not rows); the API checks it is a built-in ID or one of the user's own exercises.
  Verify: `pnpm db:migrate` works locally and on dev; tables visible in the Neon console.
- [ ] **M2-02 Cognito**: user pool (email + Google) in Terraform, managed login, PKCE; sign-in / sign-out / token refresh in the web app. Add the Cognito origins to the Content-Security-Policy ("Security headers" in [architecture.md](architecture.md)).
  Verify: 👤 Google sign-in completes inside the home-screen PWA on iPhone and returns to the app.
- [ ] **M2-03 API auth**: verify the Cognito JWT on every request, read from `x-gainframe-token` (CloudFront overwrites `Authorization`; [ADR-0002](adr/0002-cloudfront-to-api-auth.md)); `user_id` from the token only; the access line from M0-09 gains `userId` (the Cognito `sub`, never the email).
  Verify: no token → 401; an integration test proves user A cannot read user B's data.
- [ ] **M2-04 Sync endpoints**: `POST /sync/push` (batch upsert, last-writer-wins on `updated_at`, soft delete, clock-skew limit) and `GET /sync/pull?cursor=` on the per-user `server_version`, as specified in [ADR-0003](adr/0003-data-model-and-sync.md). Integration tests for conflicts, deletes and replays. Each push logs one line with counts (received, applied, ignored as older, rejected by validation with the Zod issue paths); never row contents.
  Verify: tests pass; the conflict test documents what happens when two devices edit the same set.
- [ ] **M2-05 Client sync engine**: one API fetch wrapper that adds `x-gainframe-token` and, for `PUT`/`POST`, `x-amz-content-sha256` (ADR-0002); outbox batching, pull on reconnect and foreground, backoff, sync status in the UI. A failed request records its status and `x-request-id` in Diagnostics; outbox size and last successful sync are shown there.
  Verify: log 3 sets in airplane mode → reconnect → they appear on a second device.
- [ ] **M2-06 First-sign-in merge**: local data from M1 is attached to the account on first sign-in.
  Verify: the owner's M1 history survives sign-in intact.
- [ ] **M2-07 prod environment**: `infra/envs/prod`; GitHub Environment requiring the owner's approval; prod uses the Neon prod branch. A job in an Environment gets the OIDC subject `repo:…:environment:prod`, so the apply role's trust policy in `infra/bootstrap` must list it (👤 owner applies the bootstrap change), and `plan.yml` gains a prod plan.
  Verify: merges update dev automatically; prod waits for approval, then serves.
- [ ] **M2-08 Monitoring**: a CloudWatch metric filter on `"level":"error"` log lines with an email alarm (SNS), because Hono turns thrown errors into 500 responses and Lambda's own `Errors` metric never sees them; alarms on Lambda `Errors` (crashes, init failures, timeouts) and `Throttles`; `POST /api/client-errors` (auth required, Zod-validated, size-capped) ships the Diagnostics buffer and logs each entry as `source: web`; saved Logs Insights queries in Terraform (by request ID, errors in the last 24 h, slowest routes); `docs/debugging.md`, a short runbook from "something broke" to the log line; every log group has retention.
  Verify: a dev-only `/api/debug/throw` produces an error line with its request ID and an alarm email within minutes; an error thrown in the web app appears in CloudWatch with the same release SHA.
- [ ] **M2-09 Security pass**: `/security-review`; limit `/api/health` before the repository and URL are public: the public check skips the database, and the database check needs a token only CI holds, so bots cannot keep the Neon compute awake ("Known gotchas" in architecture.md); optionally a Strix scan of dev (see [tooling.md](tooling.md)); findings become issues and get fixed.
  Verify: no open high-severity findings.

## M3 Food logging + AI vision (weeks 8–10)

Done when: a meal is logged in under 30 seconds and the eval script reports mean protein error.

- [ ] **M3-01 Food domain model**: meal and meal_item schemas, nutrition totals, `local_date`; Dexie and sync extended to both tables.
  Verify: tests pass; a manual meal syncs to a second device.
- [ ] **M3-02 Manual entry + frequent foods**: add foods manually; one-tap add from frequent foods; swipe to delete.
  Verify: a frequent-food meal takes ≤ 10 seconds.
- [ ] **M3-03 Photo upload**: client-side resize (long edge ≤ 1600 px); presigned PUT URL from the API (type and size limits, 5-minute expiry); 30-day S3 lifecycle. Add the bucket origin (`connect-src`) and `blob:` (`img-src`) to the Content-Security-Policy.
  Verify: the photo lands in S3; the lifecycle rule is visible; oversized files are rejected.
- [ ] **M3-04 AI service layer**: `apps/api/src/ai` with one interface and Bedrock, Anthropic and OpenAI providers; model IDs in config; Zod-validated structured output with one retry; timeouts; per-user daily caps in Postgres. One log line per call: feature, provider, model, prompt version, latency, tokens in/out and outcome (`ok`, `retried`, `invalid`, `timeout`, `capped`, `provider_error`); on invalid output only the Zod issue paths are logged.
  Verify: unit tests with a fake provider cover retry, timeout and cap, and assert each outcome's log line; one real Bedrock call succeeds on dev and its line is in CloudWatch.
- [ ] **M3-05 Vision estimate endpoint**: `prompts/vision/v1.md`; relevant past corrections for this user sent as reference; returns items with grams, protein, kcal and alternative names.
  Verify: three test photos return JSON that passes schema validation.
- [ ] **M3-06 Confirm screen**: scan animation, tap-to-correct names (alternatives first), gram steppers, oil/sauce prompt, meal type, "remember this correction"; saves both the AI's raw output and the final values.
  Verify: 👤 a real meal is logged in under 30 seconds; the Today screen updates.
- [ ] **M3-07 Bring-your-own key**: Claude or OpenAI key in settings. ADR first (recommended: the key stays on the device and is sent per request over HTTPS; the server never stores or logs it).
  Verify: requests use the user's provider; the key never appears in logs.
- [ ] **M3-08 Eval script**: `pnpm eval:vision` reads the labelled set and reports mean absolute error for protein and kcal per prompt version as Markdown. Photos stay in private S3 or locally, never in the repo.
  Verify: one run produces the v1 error figures for the README draft.
- [ ] **M3-09 👤 Eval dataset**: the owner photographs packaged or weighed meals and records true protein and kcal; target 30–50.
  Verify: ≥ 30 labelled entries.

## M4 Goals, body weight and trends (weeks 11–12)

Done when: the first screen shows what is left for today and this week's weight change.

- [ ] **M4-01 Goal settings**: phase (default: bulk), protein method (g/kg or fixed), energy estimate (Mifflin-St Jeor × activity factor), suggested surplus; all overridable.
  Verify: suggestions for the owner's height and weight match a hand calculation (formula in the tests).
- [ ] **M4-02 Body weight**: daily weigh-ins, 7-day average, weekly rate, target corridor.
  Verify: fixture tests check averages and rate; the UI shows on target / too slow / too fast.
- [ ] **M4-03 Today screen**: surplus gauge, protein ring, today's workout, weight card, all live.
  Verify: logging a meal rolls the numbers on Today to their new values.
- [ ] **M4-04 Trend charts**: visx charts for weight, per-exercise e1RM, weekly volume, protein and kcal history; scrubbing tooltip.
  Verify: scrubbing holds 60 fps on iPhone (Safari timeline).
- [ ] **M4-05 Wide layout**: two-column desktop layout for reviewers on laptops.
  Verify: no stretched single-column pages at 1440 px.

## M5 Insights: nudges, plateau detection and weekly report (weeks 13–14)

Done when: seeded plateau data triggers an analysis, and a Monday report arrives based on real data.

- [ ] **M5-01 Web Push**: VAPID keys in SSM; subscription flow (iOS requires a home-screen install and a user gesture); `push_subscriptions` table; send helper.
  Verify: 👤 "Send test notification" arrives on the iPhone.
- [ ] **M5-02 Lock-screen rest notification**: completing a set schedules a one-off EventBridge Scheduler job that sends a push when rest ends; skipping rest cancels it.
  Verify: lock the phone after a set and the notification arrives on time; skipping rest sends nothing.
- [ ] **M5-03 Nudge rules engine**: pure functions with configurable thresholds; first rule: high-volume session with a large protein gap.
  Verify: fixture tests cover triggering and non-triggering cases.
- [ ] **M5-04 Plateau rules**: an exercise's e1RM flat for 3 weeks (≥ 3 sessions); weekly average weight flat for 2 weeks.
  Verify: fixture tests cover trigger, no-trigger and boundaries.
- [ ] **M5-05 Plateau analysis**: snapshot → AI structured explanation and suggestions → `nudges` → push.
  Verify: for seeded plateau data, the analysis cites real numbers from the snapshot.
- [ ] **M5-06 Weekly report**: Monday 08:00 Malaysia time; stats snapshot + AI text in `weekly_summaries`; report card on Today. Scheduled jobs log a start and a finish line with counts (users processed, failed), so a silent skip is visible; failures reach the M2-08 alarm.
  Verify: a manual run matches the database for session count and on-target days.
- [ ] **M5-07 Report eval**: fixed snapshots; generated reports contain no invented numbers (rule-based assertions).
  Verify: `pnpm eval:summary` passes.

## M6 AI coach (weeks 15–16, MVP complete)

Done when: "Why has my bench stalled?" is answered with the user's own data, and off-topic questions are declined.

- [ ] **M6-01 Topic guard**: small-model classifier for fitness scope; ≥ 50 in- and out-of-scope test questions; eval reports accuracy.
  Verify: `pnpm eval:guard` reports ≥ 95% accuracy.
- [ ] **M6-02 Data tools**: get_workouts, get_exercise_progress, get_templates (exercises, target reps and rest, so the coach can explain or adjust a rest time), get_nutrition_summary, get_weight_trend, get_plateaus. Read-only; `user_id` injected server-side, never chosen by the model; Zod-validated parameters.
  Verify: unit tests prove tools only return the current user's data.
- [ ] **M6-03 Coach endpoint**: tool-use loop (max N iterations), streaming, last few turns only, daily cap, refers injury and medication questions to professionals.
  Verify: "Why has my bench stalled?" cites real numbers.
- [ ] **M6-04 Coach UI**: follows the design system (no chat bubbles; answers render like data cards with an AI source tag); "not medical advice" notice.
  Verify: 👤 three questions on the phone feel smooth.
- [ ] **M6-05 Coach eval**: fixed user data and questions; checks tool choice and refusals.
  Verify: `pnpm eval:coach` passes.

## M7 Polish and showcase (weeks 17–18)

Done when: a stranger understands the project and tries it within 5 minutes.

- [ ] **M7-01 Demo account**: seed script with sample data; daily AI cap; nightly reset.
- [ ] **M7-02 Landing page**: one-line pitch, animated GIF, "Try it" button.
- [ ] **M7-03 Bilingual README**: pitch, demo link, GIFs, architecture diagram, real usage data, AI eval results, cost.
- [ ] **M7-04 ADRs**: complete the set to 5–8.
- [ ] **M7-05 Playwright coverage**: workout, food confirmation, sign-in and sync.
- [ ] **M7-06 Security and performance**: Strix scan of dev before release; Lighthouse PWA and performance reports; findings resolved.
- [ ] **M7-07 Demo media**: GIFs and screenshots of the Terraform plan comment, deploys and alarms.
- [ ] **M7-08 Blog post**: e.g. "How accurate is AI at estimating protein?"

Verify (all of M7): someone new to the project understands it and tries it successfully within 5 minutes.

---

If time runs short, compress M4 and M7 first; M5 and M6 are the differentiators and stay. After the MVP: training programmes, CSV import/export, text-based meal estimates.
