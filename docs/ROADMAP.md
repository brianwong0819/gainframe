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
- [ ] **M0-03 👤 AWS account security**: MFA on root, then stop using root; enable IAM Identity Center with an admin user; Budgets email alerts at USD 1 and 5; Cost Anomaly Detection; request Claude model access in Bedrock (ap-southeast-1) and note the available inference profile IDs.
  Verify: after `aws sso login`, `aws sts get-caller-identity` returns the new user; the Bedrock playground answers a prompt with Claude.
- [x] **M0-04 Monorepo skeleton**: pnpm workspaces (`apps/web`, `apps/api`, `packages/shared`, `infra`); shared strict TypeScript config; ESLint + Prettier; Vitest; a root `pnpm check` that runs lint, typecheck and tests; a Claude Code hook in `.claude/settings.json` that runs Prettier and ESLint after every edit. Pin the newest Node major supported by Lambda in `.nvmrc` and `engines`. `web` is an empty Next.js static export; `api` is a Hono app with `/health` and a unit test.
  Verify: on a fresh clone, `pnpm install && pnpm check && pnpm build` pass; `pnpm --filter web dev` serves the page.
- [ ] **M0-05 Local database**: `docker-compose.yml` with Postgres (same major as Neon); `.env.example`; `pnpm db:up` / `db:down`.
  Verify: after `pnpm db:up`, `pnpm --filter api dev` and `/health` reports the database as connected.
- [ ] **M0-06 CI**: GitHub Actions on every PR: install, lint, typecheck, test (Postgres service container), build; pnpm cache; gitleaks secret scanning (CI fails if a secret or account ID is committed). 👤 Owner enables branch protection on `main`: PR required, CI must pass.
  Verify: a PR with a deliberate type error turns CI red; fixing it turns it green.
- [ ] **M0-07 Terraform bootstrap**: `infra/bootstrap` with the state bucket (versioned, encrypted, S3 native locking, no DynamoDB), the GitHub OIDC provider and two IAM roles (read-only plan role for PRs, apply role for `main`). 👤 Applied once locally by the owner.
  Verify: `terraform plan` shows no changes; both roles exist and their trust policy only allows this repository.
- [ ] **M0-08 dev infrastructure**: `infra/envs/dev` plus reusable `infra/modules`: S3 site bucket + CloudFront (OAC), Lambda (zip) + Function URL, CloudFront routing `/api/*` to Lambda, SSM parameters, 14-day log retention, `project=gainframe` / `env=dev` tags. Settle the CloudFront → Function URL auth approach first (see "Known gotchas" in architecture.md) and record it as an ADR.
  Verify: the CloudFront domain serves the empty page and `/api/health` returns `ok`; the raw Function URL rejects direct calls.
- [ ] **M0-09 CD**: PRs get an automatic `terraform plan` comment; merging to `main` builds, applies dev, uploads the site to S3 and invalidates CloudFront.
  Verify: a one-line text change is live on dev within 10 minutes of merging; the PR shows the plan comment.
- [ ] **M0-10 Design tokens and motion foundation**: port the prototype's colours, type, spacing, radii and three springs into `apps/web/src/styles/tokens.css` and the Tailwind theme; self-host Martian Mono; `motion` presets (std / pop / soft / press); `<Pressable>` (0.96 press with spring release); reduced-motion fallback; a dev-only `/dev/kitchen-sink` page showing every token and animation. Spec: [design-system.md](design-system.md).
  Verify: on an iPhone, the kitchen sink switches correctly between light and dark and the press feedback matches the prototype; with Reduce Motion on, only fades remain.
- [ ] **M0-11 PWA shell**: manifest, icons, splash screen, safe areas; Serwist precaches the app shell; opening offline shows the app, not a browser error.
  Verify: 👤 "Add to Home Screen" in iPhone Safari opens full-screen; it still opens in airplane mode.
- [ ] **M0-12 👤 Rest-timer field test**: a standalone page with a rest countdown, Wake Lock, and an audio cue (unlocked by a tap, as iOS requires). The owner uses it at the gym 2–3 times.
  Verify: findings recorded in ADR-0003 (behaviour when locked, when switching apps, during a call).
- [ ] **M0-13 ADRs and board**: ADR-0001 data model and sync rules, ADR-0002 PWA over native, ADR-0003 iOS timer limits and the three-layer fallback. Create M1 issues and a GitHub Projects board with `gh`.
  Verify: three ADRs in `docs/adr/`; every M1 task is on the board.

## M1 Workout logging + rest timer (weeks 3–5, local data only)

Done when: a full week of training is logged only in Gainframe, at ≤ 5 seconds per set.

- [ ] **M1-01 Workout domain model**: Zod schemas in `packages/shared` (exercise, template, workout, set) and pure functions: estimated 1RM (Epley), volume, previous performance for an exercise, PR detection. Unit tests cover edge cases (0 reps, warm-up and drop sets never count as PRs).
  Verify: `pnpm test` passes; every test case reads clearly.
- [ ] **M1-02 Local database layer**: Dexie schema v1; per-table repositories; client-generated UUIDv7; automatic `created_at` / `updated_at`; soft delete; outbox table reserved for M2. Tested with fake-indexeddb.
  Verify: tests pass; written rows appear in DevTools → IndexedDB.
- [ ] **M1-03 App shell and navigation**: three tabs (Today / Workout / Food), icon transitions, page transitions (View Transitions), next-intl zh/en switching (confirm the static-export approach first).
  Verify: tab switching is smooth on an iPhone; in English mode no hard-coded Chinese remains.
- [ ] **M1-04 Exercise library**: ~60 built-in exercises (zh/en names, muscle group, equipment, default rest); search; create and edit custom exercises.
  Verify: "卧推" and "bench" both find bench press; a custom exercise survives an app restart.
- [ ] **M1-05 Active workout + set logging**: start an empty workout and add exercises; each set row shows and pre-fills last time's numbers; weight/rep steppers; set types (warm-up / working / drop / failure), RPE, notes; completion check animation and rolling digits.
  Verify: one-handed, a set is logged in ≤ 5 seconds; a page reload loses nothing.
- [ ] **M1-06 Rest timer**: completing a set starts a countdown using the exercise's default; ±15 s; the sheet collapses to a pill; Wake Lock; audio cue.
  Verify: complete a set → sheet rises → drag to pill → cue plays on time (error < 1 s).
- [ ] **M1-07 Supersets**: group two or more exercises and alternate; rest starts only after a full round.
  Verify: three rounds of A1/A2 start the timer only at the end of each round.
- [ ] **M1-08 Finish workout + summary**: duration, volume, PRs; the three celebration tiers (chalk / plates / ripple) with their timing rules.
  Verify: a PR triggers the plates and the "New PR" tag; a normal set shows only chalk.
- [ ] **M1-09 Templates**: create from scratch, save a finished workout as a template, start from a template.
  Verify: starting "Push A" restores exercise order and target sets.
- [ ] **M1-10 History**: workout list, workout detail, edit or delete past sets (swipe to delete).
  Verify: editing a past set's weight updates "last time" in the next workout.
- [ ] **M1-11 End-to-end test**: Playwright at iPhone viewport: offline start → log 3 sets → finish → visible in history. Runs in CI.
  Verify: green in CI; deliberately breaking set logging turns it red.
- [ ] **M1-12 👤 Field week**: the owner logs every session in Gainframe for a week; problems become issues, severe ones fixed that week.
  Verify: the week's sessions are in history; the issue list is the bug list.

## M2 Accounts and sync (weeks 6–7)

Done when: signing in on a second device shows all data.

- [ ] **M2-01 Neon + Drizzle**: 👤 owner creates the Neon project (Singapore) with `dev` and `prod` branches; connection strings in SSM. Drizzle schema mirrors Dexie; `drizzle-kit generate` migrations; deploys migrate dev automatically.
  Verify: `pnpm db:migrate` works locally and on dev; tables visible in the Neon console.
- [ ] **M2-02 Cognito**: user pool (email + Google) in Terraform, managed login, PKCE; sign-in / sign-out / token refresh in the web app.
  Verify: 👤 Google sign-in completes inside the home-screen PWA on iPhone and returns to the app.
- [ ] **M2-03 API auth and basics**: verify the Cognito JWT on every request; `user_id` from the token only; one error shape; structured JSON logs; request IDs.
  Verify: no token → 401; an integration test proves user A cannot read user B's data.
- [ ] **M2-04 Sync endpoints**: `POST /sync/push` (batch upsert, last-writer-wins on `updated_at`, soft delete) and `GET /sync/pull?cursor=`. Integration tests for conflicts, deletes and replays.
  Verify: tests pass; the conflict test documents what happens when two devices edit the same set.
- [ ] **M2-05 Client sync engine**: outbox batching, pull on reconnect and foreground, backoff, sync status in the UI.
  Verify: log 3 sets in airplane mode → reconnect → they appear on a second device.
- [ ] **M2-06 First-sign-in merge**: local data from M1 is attached to the account on first sign-in.
  Verify: the owner's M1 history survives sign-in intact.
- [ ] **M2-07 prod environment**: `infra/envs/prod`; GitHub Environment requiring the owner's approval; prod uses the Neon prod branch.
  Verify: merges update dev automatically; prod waits for approval, then serves.
- [ ] **M2-08 Monitoring**: email alarms for Lambda errors and throttles; front-end errors reported to an endpoint and logged in CloudWatch; every log group has retention.
  Verify: a dev-only `/api/debug/throw` triggers an alarm email within minutes.
- [ ] **M2-09 Security pass**: `/security-review`; optionally a Strix scan of dev (see [tooling.md](tooling.md)); findings become issues and get fixed.
  Verify: no open high-severity findings.

## M3 Food logging + AI vision (weeks 8–10)

Done when: a meal is logged in under 30 seconds and the eval script reports mean protein error.

- [ ] **M3-01 Food domain model**: meal and meal_item schemas, nutrition totals, `local_date`; Dexie and sync extended to both tables.
  Verify: tests pass; a manual meal syncs to a second device.
- [ ] **M3-02 Manual entry + frequent foods**: add foods manually; one-tap add from frequent foods; swipe to delete.
  Verify: a frequent-food meal takes ≤ 10 seconds.
- [ ] **M3-03 Photo upload**: client-side resize (long edge ≤ 1600 px); presigned PUT URL from the API (type and size limits, 5-minute expiry); 30-day S3 lifecycle.
  Verify: the photo lands in S3; the lifecycle rule is visible; oversized files are rejected.
- [ ] **M3-04 AI service layer**: `apps/api/src/ai` with one interface and Bedrock, Anthropic and OpenAI providers; model IDs in config; Zod-validated structured output with one retry; timeouts; token usage logging; per-user daily caps in Postgres.
  Verify: unit tests with a fake provider cover retry, timeout and cap; one real Bedrock call succeeds on dev.
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
- [ ] **M5-06 Weekly report**: Monday 08:00 Malaysia time; stats snapshot + AI text in `weekly_summaries`; report card on Today.
  Verify: a manual run matches the database for session count and on-target days.
- [ ] **M5-07 Report eval**: fixed snapshots; generated reports contain no invented numbers (rule-based assertions).
  Verify: `pnpm eval:summary` passes.

## M6 AI coach (weeks 15–16, MVP complete)

Done when: "Why has my bench stalled?" is answered with the user's own data, and off-topic questions are declined.

- [ ] **M6-01 Topic guard**: small-model classifier for fitness scope; ≥ 50 in- and out-of-scope test questions; eval reports accuracy.
  Verify: `pnpm eval:guard` reports ≥ 95% accuracy.
- [ ] **M6-02 Data tools**: get_workouts, get_exercise_progress, get_nutrition_summary, get_weight_trend, get_plateaus. Read-only; `user_id` injected server-side, never chosen by the model; Zod-validated parameters.
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
