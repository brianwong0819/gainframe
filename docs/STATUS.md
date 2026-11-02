# Status

The handover note between sessions. Keep it short and current; update it in every PR and before ending any session mid-task.

- **Milestone:** M0 Foundation
- **Current task:** M0-04 monorepo skeleton (in review) → next: M0-05 local database
- **Last updated:** 2026-11-02

## Where I stopped

M0-01 to M0-03 done. AWS: advanced features active, workload account restricted to `ap-southeast-1` by SCP, CLI sign-in via `aws login --profile gainframe`, Budgets and Cost Anomaly Detection in the management account, Claude available in Bedrock through `global.` inference profiles. The workload account is named `gainframe`. Details in `docs/infra.md` ("Account structure") and `docs/ai.md` ("Bedrock model availability").

Toolchain on bw's machine (2026-10-30): Node 24.22 via fnm, pnpm via corepack, Terraform 1.16, AWS CLI 2.39, gh 2.103, Docker Desktop 4.97. Repo at `C:\dev\gainframe`.

M0-04 (2026-11-02): pnpm 12 workspace with `apps/web` (empty Next.js 16 static export), `apps/api` (Hono, `GET /api/health`), `packages/shared` (empty public entry), `infra/` (README only). Root `pnpm check` = ESLint + Prettier + `tsc` + Vitest. Node 24 pinned (`.nvmrc`, `engines`; Lambda `nodejs24.x`).

## Blocked on bw

_None._

## Follow-ups (noticed, not in scope yet)

- `apps/api` builds with plain `tsc`; bundling for the Lambda zip (and importing `@gainframe/shared` at runtime) is decided in M0-08.
- TypeScript is pinned to 6.0 because `typescript-eslint` 8.72 supports `<6.1`; move to TypeScript 7 once it does.
- `eslint-config-next` bundles plugins (`react`, `jsx-a11y`, `import`) whose peer ranges stop at ESLint 9, so `pnpm install` prints a peer warning. Next.js documents ESLint 10 as supported; lint runs clean. Re-check on each Next upgrade.
- `next dev` writes `apps/web/AGENTS.md`, pointing agents at the docs bundled in `node_modules/next/dist/docs/`. Consider referencing it from `CLAUDE.md`.
