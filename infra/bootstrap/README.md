# infra/bootstrap

The resources every other Terraform stack and CI depend on. Applied by hand by the owner; CI never applies this stack.

| Resource | Purpose |
|---|---|
| S3 bucket `gainframe-tfstate` | Remote state for all stacks (`<stack>/terraform.tfstate`). Versioned, SSE-S3, public access blocked, TLS only, S3 native locking (`use_lockfile`, no DynamoDB). `prevent_destroy`. |
| IAM OIDC provider `token.actions.githubusercontent.com` | Lets GitHub Actions exchange its OIDC token for short-lived AWS credentials. |
| IAM role `gainframe-ci-plan` | Assumable only by pull request workflows of `brianwong0819/gainframe`. `ReadOnlyAccess`, lock-file writes on the state bucket, and no object reads outside it. |
| IAM role `gainframe-ci-apply` | Assumable only by workflows running on `main`. `PowerUserAccess`, IAM limited to `gainframe-*` roles and policies, and explicit denies on changing the CI roles, the OIDC provider or the state bucket's protections. |

Outputs are names only. The ARNs contain the account ID, so CI builds them from the `AWS_ACCOUNT_ID` secret.

## Prerequisites

Terraform 1.16+ and AWS CLI 2.32+ (`terraform version`, `aws --version`), signed in with `aws login --profile gainframe`. Terraform 1.15+ with AWS provider 6.23+ reads `aws login` credentials directly.

## First apply (once)

The backend bucket does not exist yet, so the first run uses local state and then moves it into the bucket. PowerShell, from `C:\dev\gainframe\infra\bootstrap` (arguments containing `=` and `.` are quoted, or PowerShell splits them):

```powershell
$env:AWS_PROFILE = "gainframe"
aws login --profile gainframe

# 1. Temporarily override the backend with local state (the file is gitignored).
@'
terraform {
  backend "local" {}
}
'@ | Set-Content backend_override.tf

terraform init
terraform plan "-out=bootstrap.tfplan" # review: 14 to add, 0 to change, 0 to destroy
terraform apply bootstrap.tfplan

# 2. Remove the override and move the state into the new bucket.
Remove-Item backend_override.tf, bootstrap.tfplan
terraform init -migrate-state          # answer "yes"
Remove-Item terraform.tfstate

# 3. Verify.
terraform plan                         # expect: No changes.
```

## Later changes

`terraform init`, then `terraform plan` and `terraform apply` as usual; state and locking are remote.
