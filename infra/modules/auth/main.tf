# Accounts: a Cognito user pool with email sign-in through managed login and a
# public app client for the web app (authorization code with PKCE, no secret).
# Design: "Accounts and backup" in docs/design-system.md. Essentials is the
# cheapest plan with managed login; its first 10,000 monthly active users are
# free and the free tier does not expire (docs/infra.md, "Cost watch").

resource "aws_cognito_user_pool" "main" {
  name           = var.name
  user_pool_tier = "ESSENTIALS"

  # Deleting the pool deletes every account; Terraform must not do it by accident.
  deletion_protection = "ACTIVE"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  password_policy {
    minimum_length                   = 10
    require_lowercase                = false
    require_numbers                  = false
    require_symbols                  = false
    require_uppercase                = false
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Cognito's own sender (a daily quota, no SES resource) is enough for sign-up
  # codes and password resets at this scale.
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  lambda_config {
    pre_sign_up = aws_lambda_function.pre_sign_up.arn
  }
}

resource "aws_cognito_user_pool_domain" "main" {
  domain                = var.name
  user_pool_id          = aws_cognito_user_pool.main.id
  managed_login_version = 2
}

# Google as an identity provider (M2-02 part d). The owner created the OAuth
# client in Google Cloud and stored its ID and secret in SSM by hand, so the
# secret never passes through the repository. Terraform keeps it in the
# encrypted state, as it does every provider secret.
data "aws_ssm_parameter" "google_client_id" {
  name = "${var.ssm_prefix}/google-client-id"
}

data "aws_ssm_parameter" "google_client_secret" {
  name            = "${var.ssm_prefix}/google-client-secret"
  with_decryption = true
}

resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  # Cognito fills in Google's endpoints when the provider is created; they are
  # listed as Cognito stores them so that every plan does not try to remove them.
  provider_details = {
    client_id                     = data.aws_ssm_parameter.google_client_id.value
    client_secret                 = data.aws_ssm_parameter.google_client_secret.value
    authorize_scopes              = "openid email"
    attributes_url                = "https://people.googleapis.com/v1/people/me?personFields="
    attributes_url_add_attributes = "true"
    authorize_url                 = "https://accounts.google.com/o/oauth2/v2/auth"
    oidc_issuer                   = "https://accounts.google.com"
    token_request_method          = "POST"
    token_url                     = "https://www.googleapis.com/oauth2/v4/token"
  }

  # `username` must map to Google's `sub`; the email lets the app name the account.
  attribute_mapping = {
    username       = "sub"
    email          = "email"
    email_verified = "email_verified"
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.name}-web"
  user_pool_id = aws_cognito_user_pool.main.id

  # A browser cannot keep a secret; PKCE protects the code exchange instead.
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]
  supported_identity_providers         = ["COGNITO", aws_cognito_identity_provider.google.provider_name]
  callback_urls                        = var.callback_urls
  logout_urls                          = var.logout_urls
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]

  # The API rejects an expired access token and the app refreshes it; the
  # refresh token keeps a device signed in for 90 days without use.
  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 90
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
}

# Managed login renders only for an app client with a style. The default style
# for now; the design tokens are applied with the sign-in screens.
resource "aws_cognito_managed_login_branding" "web" {
  client_id    = aws_cognito_user_pool_client.web.id
  user_pool_id = aws_cognito_user_pool.main.id

  use_cognito_provided_values = true
}

data "aws_region" "current" {}

locals {
  issuer = "https://cognito-idp.${data.aws_region.current.region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

# What the API needs to verify access tokens. A parameter, not a Lambda
# environment variable: the client's callback URLs name the CloudFront domain,
# which depends on the function, so the function cannot depend on the client.
# Not secret, so a plain String.
resource "aws_ssm_parameter" "api_config" {
  name        = "${var.ssm_prefix}/auth-config"
  description = "Cognito issuer and web client ID, read by the API at cold start."
  type        = "String"
  value       = jsonencode({ issuer = local.issuer, clientId = aws_cognito_user_pool_client.web.id })
}

# The pre sign-up trigger (apps/api/src/cognito/pre-sign-up.ts): links a first
# Google sign-in to the email account with the same verified address, so one
# person has one account (ADR-0007). Billed per request, within the free tier.
data "archive_file" "pre_sign_up" {
  type        = "zip"
  source_dir  = var.pre_sign_up_source_dir
  output_path = "${var.pre_sign_up_source_dir}.zip"
}

resource "aws_cloudwatch_log_group" "pre_sign_up" {
  name              = "/aws/lambda/${var.name}-pre-sign-up"
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

resource "aws_iam_role" "pre_sign_up" {
  name               = "${var.name}-pre-sign-up"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
}

data "aws_iam_policy_document" "pre_sign_up" {
  statement {
    sid       = "WriteOwnLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.pre_sign_up.arn}:*"]
  }

  statement {
    sid       = "LinkUsers"
    actions   = ["cognito-idp:ListUsers", "cognito-idp:AdminLinkProviderForUser"]
    resources = [aws_cognito_user_pool.main.arn]
  }
}

# Not a dependency of the function: the pool depends on the function and this
# policy on the pool, so waiting for it would form a cycle.
resource "aws_iam_role_policy" "pre_sign_up" {
  name   = "${var.name}-pre-sign-up"
  role   = aws_iam_role.pre_sign_up.id
  policy = data.aws_iam_policy_document.pre_sign_up.json
}

resource "aws_lambda_function" "pre_sign_up" {
  function_name    = "${var.name}-pre-sign-up"
  role             = aws_iam_role.pre_sign_up.arn
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  filename         = data.archive_file.pre_sign_up.output_path
  source_code_hash = data.archive_file.pre_sign_up.output_base64sha256
  memory_size      = 256
  # Cognito waits at most 5 seconds for a trigger.
  timeout = 5

  environment {
    variables = {
      NODE_OPTIONS = "--enable-source-maps"
      RELEASE      = var.release
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.pre_sign_up.name
  }
}

resource "aws_lambda_permission" "pre_sign_up" {
  statement_id  = "AllowCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_sign_up.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

# Account deletion (M2-10): the API deletes the signed-in user from this pool
# and no other. Granted here because the pool depends on the API (through the
# site's callback URLs), so the API module cannot name it.
data "aws_iam_policy_document" "api_delete_user" {
  statement {
    sid       = "DeleteUsersOfThisPool"
    actions   = ["cognito-idp:AdminDeleteUser"]
    resources = [aws_cognito_user_pool.main.arn]
  }
}

resource "aws_iam_role_policy" "api_delete_user" {
  name   = "${var.name}-api-delete-user"
  role   = var.api_role_name
  policy = data.aws_iam_policy_document.api_delete_user.json
}
