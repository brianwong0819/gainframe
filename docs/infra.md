# Infrastructure, CI/CD and cost

## Principles

- **Everything in Terraform.** The console is for reading, plus the one-off account setup in ROADMAP M0-03. If you clicked something, import it or delete it.
- **CI applies, humans review.** PRs get a `terraform plan` comment; `main` applies to dev; prod needs bw's approval in GitHub Environments. No local `apply` except `infra/bootstrap` (bw, once).
- **No long-lived AWS keys.** GitHub Actions uses OIDC roles; bw uses IAM Identity Center (`aws sso login`).
- **Cost guardrail:** only always-free or pay-per-request services. Forbidden: NAT gateway, RDS/Aurora, ALB/NLB, EC2, ECS/EKS, ElastiCache, OpenSearch, provisioned concurrency, KMS customer keys (unless an ADR justifies the $1/month), CloudWatch dashboards beyond the free tier.

## Layout

- `infra/bootstrap` — state bucket (versioned, encrypted, S3 native locking via `use_lockfile`), GitHub OIDC provider, `gainframe-ci-plan` (read-only) and `gainframe-ci-apply` roles. Trust policy limited to `repo:brianwong0819/gainframe`.
- `infra/modules/*` — `site` (S3 + CloudFront), `api` (Lambda + Function URL + log group), `auth` (Cognito), `storage` (photos bucket, 30-day lifecycle), `scheduler` (EventBridge Scheduler), `monitoring` (alarms, budget).
- `infra/envs/{dev,prod}` — thin: call modules with env-specific variables.

## Conventions

- Provider and Terraform versions pinned; `terraform fmt` and `terraform validate` in CI; `tflint` if it stays cheap.
- Every resource tagged `project=gainframe`, `env=<env>`, `managed_by=terraform` (provider `default_tags`).
- Names: `gainframe-<env>-<thing>`.
- Least-privilege IAM: one role per Lambda, scoped to its own resources. No `*` actions on `*` resources.
- Log groups always have retention (14 days dev, 30 days prod).
- Secrets in SSM Parameter Store `SecureString` under `/gainframe/<env>/…`; Terraform creates the parameter with a placeholder and `lifecycle { ignore_changes = [value] }`; bw sets the real value.

## Workflows (GitHub Actions)

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | PR, push to main | install, lint, typecheck, unit + integration tests (Postgres service), build, e2e |
| `plan.yml` | PR touching `infra/**` | `terraform plan` for dev, posts the plan as a PR comment |
| `deploy.yml` | push to main | build → migrate dev DB → `terraform apply` dev → upload site → invalidate CloudFront; then waits for approval → same for prod |

Actions are pinned to a full commit SHA. Workflow permissions default to `contents: read`; jobs add only what they need (`id-token: write` for OIDC, `pull-requests: write` for plan comments).

## Cost watch

- Budgets: alerts at USD 1 and 5 per month (actual) plus forecast > 5.
- Cost Anomaly Detection on.
- Bedrock spend is capped by per-user daily limits in `ai_usage`.
- Check the Billing console at each milestone retro and note the month-to-date in STATUS.
