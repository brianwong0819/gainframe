# infra/envs/dev

The dev environment: one CloudFront distribution in front of the static site (S3) and the API (Lambda function URL), plus the API's log group and SSM parameter. Modules: [`site`](../../modules/site), [`api`](../../modules/api). Auth between CloudFront and the API: [ADR-0002](../../../docs/adr/0002-cloudfront-to-api-auth.md).

CI applies this stack on every merge to `main` (`.github/workflows/deploy.yml`, details in "Workflows" in [docs/infra.md](../../../docs/infra.md)), and pull requests get its plan as a comment. The first apply below was done by hand before CD existed; do not apply from a local machine any more. A local `terraform plan` shows `RELEASE` changing to `local`, because only CI passes the `release` variable.

## Prerequisites

`terraform version` (1.16+), `aws --version` (2.32+), `pnpm -v`, and `curl.exe --version` (ships with Windows 10 and later). Signed in with `aws login --profile gainframe`.

A Neon project for the API's database: in the [Neon console](https://console.neon.tech), create a project named `gainframe` with Postgres 18 in AWS Asia Pacific (Singapore). Under **Branches**, create a branch named `dev` from `production` with **Auto-delete: Never** (the console defaults to deleting a new branch after one day). Under **Connect**, select the `dev` branch, turn on connection pooling and copy the connection string (its host contains `-pooler`). Do not paste it anywhere else.

## First apply (once)

PowerShell. Arguments containing `=` and `.` are quoted, or PowerShell splits them.

```powershell
cd C:\dev\gainframe
git switch main
git pull
$env:AWS_PROFILE = "gainframe"
aws login --profile gainframe

# 1. Build: Terraform zips apps/api/dist/lambda; the site is apps/web/out.
pnpm install
pnpm build

# 2. Create the infrastructure. CloudFront takes a few minutes.
cd infra/envs/dev
terraform init
terraform plan "-out=dev.tfplan"   # review: 16 to add, 0 to change, 0 to destroy
terraform apply dev.tfplan
Remove-Item dev.tfplan

# 3. Store the database connection string. Read-Host keeps it out of the shell history.
$url = Read-Host "Neon pooled connection string"
aws ssm put-parameter --name /gainframe/dev/database-url --type SecureString --overwrite --value $url
Remove-Variable url

# 4. Upload the site.
aws s3 sync ../../../apps/web/out "s3://$(terraform output -raw site_bucket)" --delete
```

## Anthropic API key (owner, once)

The AI features call Claude through Anthropic's API ([ADR-0008](../../../docs/adr/0008-anthropic-api-provider.md)). Terraform creates `/gainframe/dev/anthropic-api-key` with a placeholder; until the real key is set, AI requests answer `ai_unavailable` and everything else works. In the [Anthropic Console](https://platform.claude.com): Billing, buy the smallest credit amount with auto-reload off; then API keys, create a key named `gainframe-dev` and copy it (it is shown once). Then, in PowerShell (check `aws --version` first):

```powershell
cd C:\dev\gainframe
$env:AWS_PROFILE = "gainframe"
aws login --profile gainframe
$key = Read-Host "Anthropic API key"
aws ssm put-parameter --name /gainframe/dev/anthropic-api-key --type SecureString --overwrite --value $key
Remove-Variable key
aws lambda update-function-configuration --function-name gainframe-dev-api --description "key set $(Get-Date -Format s)" --query LastUpdateStatus
```

The last command makes the function start fresh instances, which read the new key. Then run the deploy's AI call, which should print `{"ai":"ok"}`:

```powershell
Set-Content -NoNewline payload.json '{"check":"ai"}'
aws lambda invoke --function-name gainframe-dev-api --payload fileb://payload.json out.json
Get-Content out.json
Remove-Item payload.json, out.json
```

## Verify

From `C:\dev\gainframe\infra\envs\dev`. `-4` forces IPv4 (see "Connection reset" below).

```powershell
$site = terraform output -raw site_url
curl.exe -4 -i "$site/"             # 200, the empty page
curl.exe -4 -i "$site/api/health"   # 200, {"status":"ok","database":"connected"}
curl.exe -4 -i "$(terraform output -raw api_function_url)api/health"   # 403: only CloudFront may call the function
terraform plan                      # No changes.
```

## Connection reset during `terraform init` or `curl.exe`

On the owner's home network some IPv6 connections to HashiCorp and CloudFront are reset (`An existing connection was forcibly closed by the remote host`, `curl: (35) ... Connection was reset`). Browsers fall back to IPv4 and are not affected. For `curl.exe`, add `-4`. For `terraform init`, install the providers from a local folder instead of the registry; `init` still checks every file against the hashes in `.terraform.lock.hcl`:

```powershell
cd C:\dev\gainframe\infra\envs\dev
$mirror = "$env:USERPROFILE\tf-mirror"
$hc = "$mirror\registry.terraform.io\hashicorp"
New-Item -ItemType Directory -Force "$hc\archive" | Out-Null
# The AWS provider that infra/bootstrap already downloaded (same version, 6.70.0).
Copy-Item -Recurse -Force ..\..\bootstrap\.terraform\providers\registry.terraform.io\hashicorp\aws "$hc\aws"
curl.exe -4 -fL -o "$hc\archive\terraform-provider-archive_2.8.1_windows_amd64.zip" "https://releases.hashicorp.com/terraform-provider-archive/2.8.1/terraform-provider-archive_2.8.1_windows_amd64.zip"
terraform init "-plugin-dir=$mirror"
```

When a provider version in the lock file changes, add that version to the folder the same way.

The connection string never appears in Terraform: the parameter is created with a write-only placeholder, which Terraform does not store in its state.
