variable "name" {
  description = "Resource name prefix, gainframe-<env>."
  type        = string
}

variable "api_function_name" {
  description = "Lambda function behind /api/*; this module grants CloudFront permission to invoke it."
  type        = string
}

variable "api_function_url" {
  description = "Function URL of the API Lambda (https://<id>.lambda-url.<region>.on.aws/)."
  type        = string
}

variable "dev_pages" {
  description = "Route the developer pages (routes.json devPages); true only where the build includes them."
  type        = bool
  default     = false
}
