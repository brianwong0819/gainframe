output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "client_id" {
  value = aws_cognito_user_pool_client.web.id
}

# The origin of managed login and the OAuth endpoints (/oauth2/authorize, /oauth2/token).
output "domain_origin" {
  value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.region}.amazoncognito.com"
}
