# Names only: the ARNs contain the account ID, which stays out of logs and the
# repository. CI builds the ARNs from the AWS_ACCOUNT_ID secret.

output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}

output "ci_plan_role" {
  value = aws_iam_role.ci_plan.name
}

output "ci_apply_role" {
  value = aws_iam_role.ci_apply.name
}
