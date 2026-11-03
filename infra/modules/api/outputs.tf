output "function_name" {
  value = aws_lambda_function.api.function_name
}

output "function_url" {
  value = aws_lambda_function_url.api.function_url
}

output "database_url_parameter" {
  value = aws_ssm_parameter.database_url.name
}
