# infra/envs/prod

The prod environment: the same modules as [dev](../dev/README.md) (`api`, `site`, `auth`) with prod names (`gainframe-prod-*`), the `/gainframe/prod/` SSM parameters, 30-day log retention, no developer pages, and no localhost sign-in URLs. Its database is the Neon project's root branch, `production`.

CI applies it from `.github/workflows/deploy.yml` after the dev deploy of the same commit, without approval unless the change is risky ([ADR-0009](../../../docs/adr/0009-automatic-prod-deploy.md)). Pull requests get its plan next to dev's. No local apply.

## Automatic deploys (owner, once)

Before merging the pull request that adds `prod-approval` to `deploy.yml`, in that order:

1. Repository Settings → Environments → New environment `prod-approval`. Tick "Required reviewers", add yourself, and "Save protection rules". Under "Deployment branches and tags", choose "Selected branches and tags" and add `main`.
2. Environments → `prod` → untick "Required reviewers" → "Save protection rules". Leave the `main` branch rule.

If step 1 is missed, GitHub creates `prod-approval` unprotected the first time a run needs it; the job then fails instead of passing. If step 2 is missed, prod keeps waiting for approval as before.

## Before the first deploy (owner, once)

The order matters: the Environment must exist with its protection before the workflow first names it, or GitHub creates it unprotected. PowerShell; check `aws --version` (2.32+) and `terraform version` (1.16+) first.

1. **Google OAuth client.** In [Google Cloud console](https://console.cloud.google.com/apis/credentials), open the OAuth client used by dev and add the authorized redirect URI `https://gainframe-prod.auth.ap-southeast-1.amazoncognito.com/oauth2/idpresponse`. Save.
2. **Google client ID and secret for prod.** Copy dev's parameters without printing them:

   ```powershell
   cd C:\dev\gainframe
   $env:AWS_PROFILE = "gainframe"
   aws login --profile gainframe
   $id = aws ssm get-parameter --name /gainframe/dev/google-client-id --with-decryption --query Parameter.Value --output text
   $secret = aws ssm get-parameter --name /gainframe/dev/google-client-secret --with-decryption --query Parameter.Value --output text
   aws ssm put-parameter --name /gainframe/prod/google-client-id --type String --value $id
   aws ssm put-parameter --name /gainframe/prod/google-client-secret --type SecureString --value $secret
   Remove-Variable id, secret
   ```

3. **Apply role trust.** Apply `infra/bootstrap` ("Later changes" in its [README](../../bootstrap/README.md)); the plan shows 1 to change (`gainframe-ci-apply`'s trust policy gains `environment:prod`).
4. **GitHub Environment.** Repository Settings → Environments → New environment `prod`. Under "Deployment protection rules", tick "Required reviewers" and add yourself. Under "Deployment branches and tags", choose "Selected branches and tags" and add `main`. Save.

## First deploy

1. Merge the pull request. Dev deploys as usual; the run then shows "Deploy prod" waiting for review. Open the run, "Review deployments", tick `prod`, "Approve and deploy".
2. The first apply creates everything, including `/gainframe/prod/database-url` with a placeholder, so the smoke test fails at the database check. This is expected. If the parameter was stored before the first deploy, Terraform adopts it (the `import` block in `main.tf`) and never overwrites its value.
3. **Database connection string.** In the [Neon console](https://console.neon.tech), project `gainframe`, **Connect**: select the `production` branch, turn on connection pooling and copy the connection string (its host contains `-pooler`). Then:

   ```powershell
   cd C:\dev\gainframe
   $env:AWS_PROFILE = "gainframe"
   $url = Read-Host "Neon pooled connection string (production branch)"
   aws ssm put-parameter --name /gainframe/prod/database-url --type SecureString --overwrite --value $url
   Remove-Variable url
   ```

4. In the failed run, "Re-run failed jobs" and approve again. The job migrates the prod database and the smoke test passes. The run's summary shows the prod site URL in the Apply step's outputs ("site_url").

## Anthropic API key (owner, once)

The AI features call Claude through Anthropic's API ([ADR-0008](../../../docs/adr/0008-anthropic-api-provider.md)). Terraform creates `/gainframe/prod/anthropic-api-key` with a placeholder; until the real key is set, AI requests answer `ai_unavailable` and everything else works. In the [Anthropic Console](https://platform.claude.com): Billing, buy the smallest credit amount with auto-reload off; then API keys, create a key named `gainframe-prod` and copy it (it is shown once). Then, in PowerShell (check `aws --version` first):

```powershell
cd C:\dev\gainframe
$env:AWS_PROFILE = "gainframe"
aws login --profile gainframe
$key = Read-Host "Anthropic API key"
aws ssm put-parameter --name /gainframe/prod/anthropic-api-key --type SecureString --overwrite --value $key
Remove-Variable key
aws lambda update-function-configuration --function-name gainframe-prod-api --description "key set $(Get-Date -Format s)" --query LastUpdateStatus
```

The last command makes the function start fresh instances, which read the new key. Then run the deploy's AI call, which should print `{"ai":"ok"}`:

```powershell
# Windows PowerShell 5.1 has no Set-Content -NoNewline; .NET writes the file without a BOM.
[IO.File]::WriteAllText("$PWD\payload.json", '{"check":"ai"}')
aws lambda invoke --function-name gainframe-prod-api --payload fileb://payload.json out.json
Get-Content out.json
Remove-Item payload.json, out.json
```

## Verify

Merges update dev without waiting; prod waits for approval, then serves the same release (`<meta name="release">` on its page equals the commit). On the iPhone, prod is a separate Home Screen app with its own data: open the prod URL in Safari, Share → Add to Home Screen.
