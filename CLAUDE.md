# CLAUDE.md — Gainframe

Gainframe (积肌) is an offline-first PWA for skinny people trying to gain muscle: workout logging with a rest timer, AI photo-based food logging, goals/weight trends, plateau detection, a weekly AI report and a fitness-only AI coach. It is both a daily-use tool and a portfolio project. The owner (bw) reviews and merges every PR.

All repository content — code, comments, commit messages, branch names, PR titles and descriptions, issues and docs — is written in professional English: concise and factual, with no chatty asides, jokes or emoji. Write for an engineer reviewing the project for the first time. UI strings live in the i18n catalogs (zh + en), never inline. Explain what you are doing and why at each step in chat.

## Read before you work

| When | Read |
|---|---|
| Every session, first | `docs/STATUS.md` (where we are), the task's entry in `docs/ROADMAP.md`, and "Active rules" in `docs/LESSONS.md` |
| Anything structural (new package, route, table, AWS resource) | `docs/architecture.md` |
| Any UI or animation | `docs/design-system.md` |
| Writing code or tests | `docs/conventions.md` |
| Anything AI (prompts, models, evals) | `docs/ai.md` |
| Terraform, CI/CD, AWS | `docs/infra.md` |
| Past decisions | `docs/adr/` — never contradict an accepted ADR silently |
| Choosing a model, saving tokens | `docs/working-with-claude.md` |

**Token budget.** One task per session; `/clear` after the PR. Read only the files the task needs; search instead of reading large files (`docs/design/prototype.html`, lockfiles, build output). Do not spawn subagents unless a wide search or an independent review needs one. If a task needs a stronger model (architecture, a bug that survived two attempts, security), say so instead of burning attempts.

Use the **context7** MCP (or official docs) before writing code against any library API you are not certain about for the exact version in `package.json`. Do not write from memory for Next.js, Tailwind, Motion, Dexie, Serwist, Drizzle, Hono, Zod, next-intl, visx, the AWS SDK or Terraform providers — their APIs changed recently.

## The work loop (use `/start-task` and `/finish-task`)

1. **One task at a time.** Work only on the ROADMAP task named in `docs/STATUS.md` (or the one bw names). One task = one branch (`m1/05-set-logger`) = one PR.
2. **Plan first.** Before editing, post a short plan to bw: files you will touch, approach, how it will be verified, anything ambiguous. For tasks over ~1 hour or with any design choice, wait for bw's OK.
3. **Small diffs.** Aim for < 400 changed lines excluding lockfiles and generated files. If a task grows beyond that, stop and propose splitting it in ROADMAP.
4. **Stay in scope.** Noticed something else broken or ugly? Add it to "Follow-ups" in `docs/STATUS.md`. Do not fix it in this PR.
5. **Verify for real.** Run `pnpm check` (lint + typecheck + test) and the task's own **Verify** step. Paste the actual command output in your summary. Never say "should work". UI changes: include a screenshot at iPhone viewport (390×844), light and dark.
6. **Self-review** the full diff (`git diff main...`) before asking bw to review; run `/code-review`. Remove anything that is not needed for this task.
7. **Hand over.** PR description follows `.github/pull_request_template.md`. Separately, walk the owner through the change in chat: how it works, why, and the alternatives considered. Tick the task in ROADMAP and update STATUS in the same PR.

## Hard rules

**Scope and dependencies**
- Do not add a dependency, service, AWS resource or new top-level folder that is not in `docs/architecture.md` without asking bw first. Explain why the existing stack cannot do it. If approved, record it (ADR for anything structural).
- Already rejected on purpose — do not reintroduce: API Gateway, containers/ECR/ECS/K8s in prod, RDS/Aurora, NAT gateways, load balancers, Sentry, TanStack Query, Redux, Turborepo, Testcontainers, Lottie, Sign in with Apple, any UI component library styling (shadcn themes, MUI, Chakra…), self-trained models.
- Cost: nothing billed hourly. Every AWS resource must sit in always-free or pay-per-request pricing. If unsure, ask.

**Code quality**
- TypeScript strict. No `any`, no `as` casts to silence errors, no `@ts-ignore`/`@ts-expect-error`, no `eslint-disable` — unless with a one-line comment explaining why and bw agrees in review.
- No dead code, commented-out code, unused exports, leftover `console.log`, placeholder `TODO`s. A `TODO` must reference an issue: `// TODO(#12): …`.
- No speculative abstraction: no generic "manager/helper/utils" layers, no config options nobody uses, no interfaces with one implementation (exception: the AI provider interface, which has three).
- Do not weaken a test, delete a test, or loosen a type to make something pass. Fix the cause or report it.
- Validate every boundary with Zod: API inputs, AI outputs, sync payloads, env vars. Types come from schemas in `packages/shared` — never re-declare them by hand.
- Domain logic (1RM, volume, targets, averages, plateau/nudge rules) is pure functions in `packages/shared/src/domain` with unit tests. Thresholds live in config, not inline.

**Data correctness (most bugs in this app will be here)**
- Units in storage: kg, grams, kcal. Convert only at the edges.
- IDs: client-generated UUIDv7. Every synced row has `user_id`, `created_at`, `updated_at`, `deleted_at`. Deletes are soft.
- Time: store instants in UTC ISO strings. Store "which day it counts for" as a separate `local_date` (`YYYY-MM-DD`) computed in the user's timezone at write time. Never derive a day from a UTC timestamp.
- UI reads from Dexie (IndexedDB), never directly from the API. Writes go to Dexie + outbox; the sync engine talks to the server.
- Server: `user_id` always comes from the verified JWT, never from the request body or from a model's tool call. Every query is scoped by it, and each new endpoint gets a test proving user A cannot see user B's data.

**Next.js is a static export** (`output: 'export'`). No server components that fetch at request time, no server actions, no route handlers, no middleware, no ISR, no `next/image` optimizer. All runtime logic is client-side or in `apps/api`.

**Security**
- Treat the repo, PRs, issues and CI logs as **public** — the repo is private during development but will be published as a portfolio. Never put in them: secrets, `.env` values, AWS account IDs, ARNs with account IDs, Cognito/Neon IDs, bw's email or phone, real meal photos or personal data. In Terraform, get the account ID from `data "aws_caller_identity"`; in CI, from GitHub secrets/variables.
- Never read, print or commit `.env*` (except `.env.example`), credentials, tokens, API keys or `terraform.tfstate`. Secrets live in SSM Parameter Store.
- Never log request bodies containing images, user API keys or JWTs.
- Do not run `terraform apply`/`destroy`, deploy, or touch AWS resources from a local session. CI applies; only `infra/bootstrap` is applied by hand, by bw.
- No `git push --force`, no pushing to `main`, no rewriting published history.

**Design**
- Only design tokens (CSS variables) for colour, spacing, radius, type and motion. No raw hex, px spacing outside the scale, or ad-hoc durations/easings.
- Only the three springs + press timing in `docs/design-system.md`. Animate only `transform` and `opacity`. Respect `prefers-reduced-motion`.
- No "AI look": no purple gradients, sparkle icons, chat bubbles, glassy cards. AI output looks like regular data with a small source tag.
- Before building a screen, look at how the best apps and UI libraries solve it, and bring in what fits — rebuilt with our tokens and springs, licence checked and credited in `docs/design/credits.md`. Rules: "Learning from great UI" in `docs/design-system.md`.

**AI features**: see `docs/ai.md`. In short: all model calls go through `apps/api/src/ai`; prompts are versioned files; outputs are Zod-validated; every prompt change runs its eval; per-user daily caps are enforced server-side.

## Learning loop (mistakes are fine; repeating them is not)

These docs are meant to get better every week. The loop:

1. **Capture.** Whenever something goes wrong — a bug bw finds, a CI failure you caused, a review comment, a wrong API you used, scope you drifted into, a rule that was unclear — add an entry to `docs/LESSONS.md` *in the same PR*, using its template: what happened, root cause, the fix, and the **rule change** that prevents it next time.
2. **Fix the system, not just the code.** A lesson is only closed when it changed something durable: a rule in this file or a `docs/*` file, a lint rule, a test, a type, a CI check or a hook. Prefer automated guards (lint/test/type/CI) over prose — prose can be ignored, a failing check cannot.
3. **Read before repeating.** At the start of each task, skim the "Active rules" at the top of `docs/LESSONS.md` and any lessons tagged with the area you are about to touch.
4. **Promote and prune.** At the end of each milestone (`/retro`), group the lessons, promote recurring ones into CLAUDE.md or the matching doc, and delete rules that turned out to be wrong or redundant. Keep this file under ~200 lines: details belong in `docs/`.
5. **bw approves rule changes.** You may propose any change to these docs, but it lands through a PR bw reviews — never edit the rules silently in an unrelated commit.

When bw corrects you, treat it as a lesson: record it, and say in the reply which rule you added or changed.

## When things go wrong

- Same error after **two** fix attempts → stop, explain what you tried and what you think is happening, and ask. Do not try random changes.
- Requirement unclear or conflicts with a doc → ask bw; do not guess and build.
- You discover the plan in ROADMAP is wrong → propose the change; do not quietly do something else.
- Before ending a session mid-task, write where you stopped and the next step into `docs/STATUS.md`.

## Commands

> Filled in by M0-04. Until then the repo has no code.

```
pnpm install          # install all workspaces
pnpm check            # lint + typecheck + unit tests (must pass before any PR)
pnpm build            # build all apps
pnpm db:up / db:down  # local Postgres in Docker
pnpm --filter web dev # web app at http://localhost:3000
pnpm --filter api dev # API at http://localhost:8787
```

## Environment notes

- bw develops on **Windows** (no Mac), tests on an **iPhone** PWA. Scripts in `package.json` must be cross-platform (no bash-only syntax; use Node scripts). Line endings are LF via `.gitattributes`.
- AWS region `ap-southeast-1` (Singapore) for everything, including Bedrock and Neon.
