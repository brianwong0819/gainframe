# Debugging

From "something broke" to the log line that explains it. The design behind it is "Observability" in [architecture.md](architecture.md); the alarms and saved queries live in [`infra/modules/monitoring`](../infra/modules/monitoring).

## 1. Get the evidence

- **On the phone.** Settings → Diagnostics → "复制错误报告" copies every recorded error with its time, page, release and, for a failed request, the status and `x-request-id`. The request ID is the key to step 3.
- **From an alarm email.** The subject names the alarm (table below) and the environment (`gainframe-dev-…` or `gainframe-prod-…`). An alarm sends a second email when it returns to OK.

| Alarm | Means | Look at |
|---|---|---|
| `<env>-error-lines` | The API or the pre sign-up trigger logged a line at `level: error` in the last 5 minutes. Hono turns a thrown error into a 500, so this is the alarm for most bugs. | Saved query `errors` |
| `<env>-api-errors` | The API function itself failed: a crash, an init failure (bad environment, a parameter it could not read) or a timeout. These never reach the logger. | The API log group around the alarm time: `REPORT` lines with `Status: timeout` or `Init Duration`, and `ERROR` lines from the runtime |
| `<env>-api-throttles` | Requests were refused at the account's concurrency limit. | Lambda → Concurrency in the console; a loop or a burst from one client |

## 2. Find the release

Every log line and every client error carries `release`, the commit SHA. Compare it with the deploy run in GitHub Actions to know which code was running.

## 3. Find the lines

CloudWatch → Logs Insights → **Saved queries** → folder `gainframe-<env>`. Pick a time range that covers the problem before running.

| Query | Use |
|---|---|
| `by-request-id` | Replace `REPLACE_WITH_REQUEST_ID` with the ID from Diagnostics or an error response. Shows the access line, any error line with its stack, and which log group (`@log`) it came from. |
| `errors` | The latest 100 error lines with request ID, route, error name and message. |
| `slowest-routes` | Requests, average, p95 and maximum duration per route, to find a route close to the 10-second timeout. |

The access line (`msg: request`) gives the route, status, duration and `userId` (the Cognito `sub`, never the email). Bodies, headers and tokens are never logged.

## 4. Reproduce and fix

Reproduce locally (`pnpm --filter api dev`, then the web app against it) or with a test, following "When things go wrong" in `CLAUDE.md`. A fix that came from an alarm gets a `docs/LESSONS.md` entry like any other bug.

## Setting up the alarm email (owner, once per environment)

The alarms publish to an SNS topic; the email subscription is made by hand so the address stays out of the repository and the Terraform state. After the deploy that creates the topic, in PowerShell:

```powershell
cd C:\dev\gainframe\infra\envs\dev      # or infra\envs\prod
$env:AWS_PROFILE = "gainframe"
aws login --profile gainframe
terraform init
$topic = terraform output -raw alarm_topic_arn
aws sns subscribe --topic-arn $topic --protocol email --notification-endpoint "you@example.com"
Remove-Variable topic
```

Replace the address with yours, then click the link in the confirmation email from AWS Notifications. Until it is confirmed, alarms change state but send nothing. To check: `aws sns list-subscriptions-by-topic --topic-arn (terraform output -raw alarm_topic_arn)` shows the endpoint with a subscription ARN instead of `PendingConfirmation`.
