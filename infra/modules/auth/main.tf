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
}

resource "aws_cognito_user_pool_domain" "main" {
  domain                = var.name
  user_pool_id          = aws_cognito_user_pool.main.id
  managed_login_version = 2
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.name}-web"
  user_pool_id = aws_cognito_user_pool.main.id

  # A browser cannot keep a secret; PKCE protects the code exchange instead.
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]
  supported_identity_providers         = ["COGNITO"]
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
