# Status

The handover note between sessions. Keep it short and current; update it in every PR and before ending any session mid-task.

- **Milestone:** M0 Foundation
- **Current task:** M0-09 API logging and error handling (after bw's first apply of dev)
- **Last updated:** 2026-11-03

## Where I stopped

M0-01 to M0-03 done. AWS: advanced features active, workload account restricted to `ap-southeast-1` by SCP, CLI sign-in via `aws login --profile gainframe`, Budgets and Cost Anomaly Detection in the management account, Claude available in Bedrock through `global.` inference profiles. The workload account is named `gainframe`. Details in `docs/infra.md` ("Account structure") and `docs/ai.md` ("Bedrock model availability").

Toolchain on bw's machine (2026-10-30): Node 24.22 via fnm, pnpm via corepack, Terraform 1.16, AWS CLI 2.39, gh 2.103, Docker Desktop 4.97. Repo at `C:\dev\gainframe`.

M0-04 (2026-11-02): pnpm 12 workspace with `apps/web` (empty Next.js 16 static export), `apps/api` (Hono, `GET /api/health`), `packages/shared` (empty public entry), `infra/` (README only). Root `pnpm check` = ESLint + Prettier + `tsc` + Vitest. Node 24 pinned (`.nvmrc`, `engines`; Lambda `nodejs24.x`).

M0-05 (2026-11-02): `docker-compose.yml` runs Postgres 18.6 (Neon supports 14–18; create the Neon project on 18). `pnpm db:up` / `db:down` at the root. The API reads `DATABASE_URL` from `apps/api/.env` (Zod-validated, see `apps/api/.env.example`), connects with `pg` (bw chose it over postgres.js and the Neon serverless driver), and `GET /api/health` returns `database: connected` or 503 `unreachable`.

Review (2026-11-02, PR `m0/review-maintainability`): added "Observability" to `docs/architecture.md`; inserted M0-09 API logging and error handling (old M0-09 to M0-13 are now M0-10 to M0-14) and M1-11 Diagnostics and data export (old M1-11/12 are now M1-12/13); tightened M0-06, M1-01/02/03, M2-01/03/04/05/08, M3-04 and M5-06; renumbered planned ADRs (sync 0002, PWA 0003, iOS timer 0004).

M0-06 (2026-11-02, PR `m0/06-ci`): `.github/workflows/ci.yml` runs on every PR and push to `main`. Job "Check and build": install (pnpm store cached), lint, typecheck, unit tests, integration tests against a Postgres 18.6 service container, build. Job "Secret scan": gitleaks 8.30.1 (checksum-verified CLI, not the licensed action) over the full git history, with `.gitleaks.toml` adding two AWS account ID rules and a self-test that they fire. Every Vitest run uses `TZ=America/Los_Angeles`. Integration tests are `*.int.test.ts` and run with `pnpm test:integration`. "Look ahead" step added to the work loop (L-009).

M0-07 (2026-11-03, PR `m0/07-terraform-bootstrap`): `infra/bootstrap` creates the state bucket `gainframe-tfstate`, the GitHub OIDC provider and the roles `gainframe-ci-plan` / `gainframe-ci-apply` (AWS provider 6.70, lock file covers `windows_amd64` and `linux_amd64`). bw applied it on 2026-11-03 (14 resources); its state now lives in the bucket under `bootstrap/`, and `terraform plan` reports no changes.

M0-08 (2026-11-03, PR `m0/08-dev-infrastructure`): `infra/modules/site` (private S3 bucket + one CloudFront distribution, `/api/*` to the function URL) and `infra/modules/api` (Lambda `nodejs24.x` arm64 zip, function URL with `AWS_IAM`, 14-day log group, SSM `SecureString` `/gainframe/dev/database-url` with a write-only placeholder); `infra/envs/dev` wires them with state key `dev/terraform.tfstate`. Both origins use origin access control ([ADR-0002](adr/0002-cloudfront-to-api-auth.md)): the client must send its token in `x-gainframe-token` and hash `PUT`/`POST` bodies. `apps/api` now builds with rolldown into one ES module (`dist/lambda/index.mjs`); `src/lambda.ts` reads the database URL from SSM at cold start. ADRs for sync, PWA and the iOS timer are renumbered 0003–0005.

## Blocked on bw

- M0-08 first apply: create the Neon project, then follow `infra/envs/dev/README.md` (apply, set the SSM value, upload the site, run the three `curl.exe` checks).
- Settings → Branches: protect `main` (require a pull request; require the status checks "Check and build" and "Secret scan").
- Settings → Code security: enable Dependabot alerts and Dependabot security updates.

## Follow-ups (noticed, not in scope yet)

- CloudFront has no rewrite for static-export routes yet (`/workout` → `/workout/index.html` or `.html`) and no custom 404; a distribution-wide custom error response would also rewrite API 403s. Add a CloudFront Function when M1-03 adds the first route.
- No security response headers (CSP, HSTS) on the site yet; add a response headers policy with the PWA shell (M0-12).
- TypeScript is pinned to 6.0 because `typescript-eslint` 8.72 supports `<6.1`; move to TypeScript 7 once it does.
- `eslint-config-next` bundles plugins (`react`, `jsx-a11y`, `import`) whose peer ranges stop at ESLint 9, so `pnpm install` prints a peer warning. Next.js documents ESLint 10 as supported; lint runs clean. Re-check on each Next upgrade.
- `next dev` writes `apps/web/AGENTS.md`, pointing agents at the docs bundled in `node_modules/next/dist/docs/`. Consider referencing it from `CLAUDE.md`.
- The API test for an unreachable database prints its error line to the test output; M0-09's logger should let tests capture log lines instead.
- The health response shape is declared in `apps/api`, not as a schema in `packages/shared`. The rolldown bundle can now include `@gainframe/shared`; move the shape there when the web app first consumes an API response.
