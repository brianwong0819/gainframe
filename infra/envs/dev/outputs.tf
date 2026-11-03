output "site_url" {
  value = "https://${module.site.domain_name}"
}

output "site_bucket" {
  value = module.site.bucket
}

output "distribution_id" {
  value = module.site.distribution_id
}

output "api_function_url" {
  description = "Direct calls must be rejected with 403; only CloudFront may invoke it."
  value       = module.api.function_url
}

output "database_url_parameter" {
  value = module.api.database_url_parameter
}
