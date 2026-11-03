# infra/envs/dev

The dev environment: one CloudFront distribution in front of the static site (S3) and the API (Lambda function URL), plus the API's log group and SSM parameter. Modules: [`site`](../../modules/site), [`api`](../../modules/api). Auth between CloudFront and the API: [ADR-0002](../../../docs/adr/0002-cloudfront-to-api-auth.md).

From M0-10, CI applies this stack on every merge to `main`. Until then, and once only, the owner applies it by hand.

## Prerequisites

`terraform version` (1.16+), `aws --version` (2.32+), `pnpm -v`, and `curl.exe --version` (ships with Windows 10 and later). Signed in with `aws login --profile gainframe`.

A Neon project for the API's database: in the [Neon console](https://console.neon.tech), create a project named `gainframe` with Postgres 18 in AWS Asia Pacific (Singapore). Under **Connect**, turn on connection pooling and copy the connection string (its host contains `-pooler`). Do not paste it anywhere else.

## First apply (once)

PowerShell, from the repository root. Arguments containing `=` and `.` are quoted, or PowerShell splits them.

```powershell
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

## Verify

```powershell
$site = terraform output -raw site_url
curl.exe -i "$site/"             # 200, the empty page
curl.exe -i "$site/api/health"   # 200, {"status":"ok","database":"connected"}
curl.exe -i "$(terraform output -raw api_function_url)api/health"   # 403: only CloudFront may call the function
terraform plan                   # No changes.
```

The connection string never appears in Terraform: the parameter is created with a write-only placeholder, which Terraform does not store in its state.
