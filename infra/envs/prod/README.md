# infra/envs/prod

The prod environment: the same modules as [dev](../dev/README.md) (`api`, `site`, `auth`) with prod names (`gainframe-prod-*`), the `/gainframe/prod/` SSM parameters, 30-day log retention, no developer pages, and no localhost sign-in URLs. Its database is the Neon project's root branch, `production`.

CI applies it from `.github/workflows/deploy.yml` after the dev deploy of the same commit, once the owner approves the `prod` Environment in GitHub. Pull requests get its plan next to dev's. No local apply.

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
2. The first apply creates everything, including `/gainframe/prod/database-url` with a placeholder, so the smoke test fails at the database check. This is expected.
3. **Database connection string.** In the [Neon console](https://console.neon.tech), project `gainframe`, **Connect**: select the `production` branch, turn on connection pooling and copy the connection string (its host contains `-pooler`). Then:

   ```powershell
   cd C:\dev\gainframe
   $env:AWS_PROFILE = "gainframe"
   $url = Read-Host "Neon pooled connection string (production branch)"
   aws ssm put-parameter --name /gainframe/prod/database-url --type SecureString --overwrite --value $url
   Remove-Variable url
   ```

4. In the failed run, "Re-run failed jobs" and approve again. The job migrates the prod database and the smoke test passes. The run's summary shows the prod site URL in the Apply step's outputs ("site_url").

## Verify

Merges update dev without waiting; prod waits for approval, then serves the same release (`<meta name="release">` on its page equals the commit). On the iPhone, prod is a separate Home Screen app with its own data: open the prod URL in Safari, Share → Add to Home Screen.
