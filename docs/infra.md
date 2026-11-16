# Infrastructure, CI/CD and cost

## Principles

- **Everything in Terraform.** The console is for reading, plus the one-off account setup in ROADMAP M0-03. If you clicked something, import it or delete it.
- **CI applies, humans review.** PRs get a `terraform plan` comment; `main` applies to dev; prod needs bw's approval in GitHub Environments. No local `apply` except `infra/bootstrap` and the first apply of `infra/envs/dev` before CD exists (bw, once each).
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

- `infra/bootstrap` — state bucket `gainframe-tfstate` (versioned, SSE-S3, TLS only, S3 native locking via `use_lockfile`), GitHub OIDC provider, `gainframe-ci-plan` (read-only, `pull_request` events) and `gainframe-ci-apply` (`main` only) roles. Trust policies pinned to the repository by its immutable OIDC subject `repo:brianwong0819@59221587/gainframe@1439499232:…` (owner and repository IDs; GitHub sends this form, not `repo:brianwong0819/gainframe:…`). Applied by hand; its own state lives in the bucket under `bootstrap/`. Details and first-run steps: [infra/bootstrap/README.md](../infra/bootstrap/README.md).
- **State:** every stack uses the S3 backend in `gainframe-tfstate` with key `<stack>/terraform.tfstate` (`envs/dev` → `dev/terraform.tfstate`), `use_lockfile = true`, `encrypt = true`.
- `infra/modules/*` — `site` (S3 + CloudFront with two origins, both behind origin access control; [ADR-0002](adr/0002-cloudfront-to-api-auth.md)), `api` (Lambda zip + Function URL + log group + SSM parameters), `auth` (Cognito), `storage` (photos bucket, 30-day lifecycle), `scheduler` (EventBridge Scheduler), `monitoring` (alarms, budget).
- `infra/envs/{dev,prod}` — thin: call modules with env-specific variables. First-apply steps: [infra/envs/dev/README.md](../infra/envs/dev/README.md).
- **API bundle:** `pnpm --filter @gainframe/api build` runs rolldown and writes one ES module (`apps/api/dist/lambda/index.mjs`, dependencies included); the `api` module zips that folder with the `archive` provider, so build before `terraform plan`. Lambda runs `nodejs24.x` on `arm64`.

## Conventions

- Provider and Terraform versions pinned; `terraform fmt` and `terraform validate` in CI; `tflint` if it stays cheap.
- Every resource tagged `project=gainframe`, `env=<env>`, `managed_by=terraform` (provider `default_tags`).
- Names: `gainframe-<env>-<thing>`.
- Least-privilege IAM: one role per Lambda, scoped to its own resources. No `*` actions on `*` resources.
- Log groups always have retention (14 days dev, 30 days prod).
- Monitoring (M2-08): a metric filter on `level=error` lines feeding an alarm, Lambda `Errors` and `Throttles` alarms, one SNS topic with an email subscription, saved Logs Insights queries (`aws_cloudwatch_query_definition`). Logging design: "Observability" in `docs/architecture.md`.
- Secrets in SSM Parameter Store `SecureString` under `/gainframe/<env>/…`. Terraform creates the parameter with a write-only placeholder (`value_wo`, never stored in state); bw sets the real value with `aws ssm put-parameter --overwrite`. Lambda reads the value at cold start; its environment holds only the parameter name.

## Workflows (GitHub Actions)

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | PR, push to main | install, lint, typecheck, unit + integration tests (Postgres service), build; `terraform fmt -check` and `validate` for every stack; device layout e2e (two devices on a PR, all six on main, skipped for a docs-only PR) |
| `plan.yml` | PR touching `infra/**`, `apps/api/**`, `packages/shared/**` or the lockfile | builds the API bundle, `terraform plan` for dev as `gainframe-ci-plan`, posts the plan as a PR comment (one comment, updated on each push; the account ID replaced) |
| `deploy.yml` | CI succeeded on a push to main (`workflow_run`) | build with `RELEASE` = the commit SHA → `terraform apply` dev as `gainframe-ci-apply` → upload the site to S3 → invalidate CloudFront → smoke test; later: migrate the dev DB (M2-01), then prod after approval (M2-07) |

Deploy details:

- **Release.** The commit SHA reaches the Lambda environment as `RELEASE` (the `release` Terraform variable; a local run reports `local`) and the web bundle as `NEXT_PUBLIC_RELEASE`, rendered as `<meta name="release">`.
- **Site upload.** Hashed assets under `_next/static` are uploaded first with `Cache-Control: public, max-age=31536000, immutable`; everything else with `no-cache`, so browsers revalidate HTML. Old hashed assets are removed only after the invalidation has completed.
- **Smoke test.** The page must carry the new release; `/api/health` must return 200 and its `x-request-id` must find its access line in the API log group within two minutes, with the same `release`; a direct invocation of the function with `{ "check": "database" }` must report the database as connected (the public route never queries it).
- **Account ID.** Workflows build role ARNs from the `AWS_ACCOUNT_ID` repository secret. GitHub masks it in logs; the plan comment replaces it explicitly, because comments are not masked.
- **Plan role and SSM.** Refreshing an `aws_ssm_parameter` decrypts it, so `gainframe-ci-plan` has `kms:Decrypt` on the `aws/ssm` key, only through SSM and only for `/gainframe/*` parameters. Only collaborators can trigger it: fork pull requests get no OIDC token.

Workflow scripts:

- A command whose failure matters runs on its own, never inside a pipeline or a `$(...)` with other commands; a smoke test asserts the healthy result (200, then `database: connected` from the direct check), not just a response (L-014).
- AWS CLI results are parsed as JSON (`--output json` piped to `jq`); text output repeats values once per page (L-013).
- An identity or permission change (trust policy, IAM policy, secret) is verified from its real caller, a workflow run, not by reading the resource (L-012).
- Workflow logs are public. Terraform output, plan text and `GITHUB_ENV` values appear in them; only repository secrets are masked. Anything that must stay private is a secret, masked with `::add-mask::`, or not printed.

Actions are pinned to a full commit SHA. Workflow permissions default to `contents: read`; jobs add only what they need (`id-token: write` for OIDC, `pull-requests: write` for plan comments).

## Cost watch

- Budgets (management account, covers the whole organization): `monthly-5usd`, credits excluded so alerts reflect real usage even while credits pay the bill; alerts at USD 1 (actual), 5 (actual) and forecast > 5.
- Cost Anomaly Detection on (management account): AWS-created services monitor, daily email summary for anomalies above USD 1 (individual alerts require SNS; not worth a topic at this scale).
- Bedrock spend is capped by per-user daily limits in `ai_usage`.
- Monitoring stays inside the free tier: up to 10 alarms and 10 custom metrics (metric filters create custom metrics), 1,000 SNS email notifications and 5 GB of log ingestion per month. No CloudWatch dashboards; saved queries are free.
- Check the Billing console at each milestone retro and note the month-to-date in STATUS.
- **GitHub Actions minutes.** Standard runners are free on a public repository, which this one is since 2026-11-15. While it was private, Actions was billed against bw's included compute (USD 12 a month), and once that was used up every workflow failed in seconds, including the required checks and the dev deploy (L-030). If the repository is ever private again, that limit applies. Each job is billed in whole minutes. Measured on 2026-11-15: the Device layout job took 10 minutes on all six devices (336 e2e tests on one worker), Check and build 2, Terraform checks and Secret scan under 1 each, Deploy 3, Terraform plan 1. Keep the expensive matrix on `main`, and check usage under Settings → Billing at each milestone retro.
