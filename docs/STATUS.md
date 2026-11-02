# Status

The handover note between sessions. Keep it short and current; update it in every PR and before ending any session mid-task.

- **Milestone:** M0 Foundation
- **Current task:** M0-04 monorepo skeleton (in progress in a separate branch)
- **Last updated:** 2026-11-02

## Where I stopped

M0-01 to M0-03 done. AWS: advanced features active, workload account restricted to `ap-southeast-1` by SCP, CLI sign-in via `aws login --profile gainframe`, Budgets and Cost Anomaly Detection in the management account, Claude available in Bedrock through `global.` inference profiles. Details in `docs/infra.md` ("Account structure") and `docs/ai.md` ("Bedrock model availability").

Toolchain on bw's machine (2026-10-30): Node 24.22 via fnm, pnpm via corepack, Terraform 1.16, AWS CLI 2.39, gh 2.103, Docker Desktop 4.97. Repo at `C:\dev\gainframe`.

## Blocked on bw

_None._

## Follow-ups (noticed, not in scope yet)

- Consider renaming the workload project from its default name to `gainframe` in AWS Settings.
