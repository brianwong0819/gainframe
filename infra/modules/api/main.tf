# The API: one Lambda function running the Hono app, reachable only through
# CloudFront (the function URL uses AWS_IAM auth; see ADR-0002).

data "archive_file" "handler" {
  type        = "zip"
  source_dir  = var.source_dir
  output_path = "${var.source_dir}.zip"
}

# Terraform writes a placeholder once; the owner sets the real value with the
# AWS CLI. A write-only argument keeps the value out of the Terraform state.
resource "aws_ssm_parameter" "database_url" {
  name             = "${var.ssm_prefix}/database-url"
  description      = "Postgres connection string for the API (Neon, pooled)."
  type             = "SecureString"
  value_wo         = "placeholder"
  value_wo_version = 1
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.name}-api"
  retention_in_days = var.log_retention_days
}

data "aws_iam_policy_document" "assume_lambda" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api" {
  name               = "${var.name}-api"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
}

data "aws_iam_policy_document" "api" {
  statement {
    sid       = "WriteOwnLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.api.arn}:*"]
  }

  # SecureString values are encrypted with the AWS managed key aws/ssm, whose
  # key policy already lets account principals decrypt through SSM.
  statement {
    sid       = "ReadOwnParameters"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.database_url.arn]
  }
}

resource "aws_iam_role_policy" "api" {
  name   = "${var.name}-api"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api.json
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.name}-api"
  role             = aws_iam_role.api.arn
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  filename         = data.archive_file.handler.output_path
  source_code_hash = data.archive_file.handler.output_base64sha256
  memory_size      = 512
  timeout          = 10

  environment {
    variables = {
      DATABASE_URL_PARAMETER = aws_ssm_parameter.database_url.name
      NODE_OPTIONS           = "--enable-source-maps"
      RELEASE                = var.release
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.api.name
  }

  depends_on = [aws_iam_role_policy.api]
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "AWS_IAM"
}
