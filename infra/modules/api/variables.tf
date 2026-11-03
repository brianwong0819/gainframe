variable "name" {
  description = "Resource name prefix, gainframe-<env>."
  type        = string
}

variable "ssm_prefix" {
  description = "SSM Parameter Store path for this environment's secrets, /gainframe/<env>."
  type        = string
}

variable "source_dir" {
  description = "Directory holding the bundled handler (apps/api/dist/lambda, built by `pnpm build`)."
  type        = string
}

variable "log_retention_days" {
  type = number
}
