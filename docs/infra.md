# Infrastructure, CI/CD and cost

## Principles

- **Everything in Terraform.** The console is for reading, plus the one-off account setup in ROADMAP M0-03. If you clicked something, import it or delete it.
- **CI applies, humans review.** PRs get a `terraform plan` comment; `main` applies to dev; prod needs bw's approval in GitHub Environments. No local `apply` except `infra/bootstrap` (bw, once).
- **No long-lived AWS keys.** GitHub Actions uses OIDC roles; bw uses `aws login` (short-lived credentials via the AWS Builder ID). See "Account structure".
- **Cost guardrail:** only always-free or pay-per-request services. Forbidden: NAT gateway, RDS/Aurora, ALB/NLB, EC2, ECS/EKS, ElastiCache, OpenSearch, provisioned concurrency, KMS customer keys (unless an ADR justifies the $1/month), CloudWatch dashboards beyond the free tier.

## Account structure

See [ADR-0001](adr/0001-aws-account-model.md). The account was created under the 2026 AWS account plans and upgraded to advanced features.

- **Management account:** billing, credits, Budgets, Cost Anomaly Detection and AWS Organizations policies only. No workload resources.
- **Workload account** (the original project account): every Gainframe resource, dev and prod. Terraform and CI target this account only.
- **Identity Delegated Admin account:** created and used by AWS; leave untouched.
- **Sign-in:** AWS Builder ID with MFA → `AccountFullAccessRole` in the workload account. Project accounts have no usable root user.
- **Region guardrail:** the SCP `AdvancedModeRegionRestrictionSecurityControlPolicy` (statement `RegionFloor`) denies every Region except `ap-southeast-1`, plus global-service calls in `us-east-1`/`us-west-2` and Bedrock inference calls (so cross-Region inference profiles work). Adding a Region means editing this SCP in the management account, and an ADR.
- **No spend limit.** Activation removed the hard spend limit permanently; cost control relies on "Cost watch" below.

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
- Monitoring (M2-08): a metric filter on `level=error` lines feeding an alarm, Lambda `Errors` and `Throttles` alarms, one SNS topic with an email subscription, saved Logs Insights queries (`aws_cloudwatch_query_definition`). Logging design: "Observability" in `docs/architecture.md`.
- Secrets in SSM Parameter Store `SecureString` under `/gainframe/<env>/…`; Terraform creates the parameter with a placeholder and `lifecycle { ignore_changes = [value] }`; bw sets the real value.

## Workflows (GitHub Actions)

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | PR, push to main | install, lint, typecheck, unit + integration tests (Postgres service), build, e2e |
| `plan.yml` | PR touching `infra/**` | `terraform plan` for dev, posts the plan as a PR comment |
| `deploy.yml` | push to main | build → migrate dev DB → `terraform apply` dev → upload site → invalidate CloudFront; then waits for approval → same for prod |

Actions are pinned to a full commit SHA. Workflow permissions default to `contents: read`; jobs add only what they need (`id-token: write` for OIDC, `pull-requests: write` for plan comments).

## Cost watch

- Budgets (management account, covers the whole organization): `monthly-5usd`, credits excluded so alerts reflect real usage even while credits pay the bill; alerts at USD 1 (actual), 5 (actual) and forecast > 5.
- Cost Anomaly Detection on (management account): AWS-created services monitor, daily email summary for anomalies above USD 1 (individual alerts require SNS; not worth a topic at this scale).
- Bedrock spend is capped by per-user daily limits in `ai_usage`.
- Monitoring stays inside the free tier: up to 10 alarms and 10 custom metrics (metric filters create custom metrics), 1,000 SNS email notifications and 5 GB of log ingestion per month. No CloudWatch dashboards; saved queries are free.
- Check the Billing console at each milestone retro and note the month-to-date in STATUS.
