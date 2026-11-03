# infra

Terraform for AWS. Layout and rules: [docs/infra.md](../docs/infra.md).

- `bootstrap/`: state bucket, GitHub OIDC provider and CI roles (M0-07)
- `modules/`: reusable `site` (S3 + CloudFront) and `api` (Lambda + function URL) modules (M0-08)
- `envs/dev`: the dev environment (M0-08); `envs/prod` follows in M2-07
