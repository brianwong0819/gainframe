variable "name" {
  description = "Resource name prefix, gainframe-<env>."
  type        = string
}

variable "api_function_name" {
  type = string
}

variable "log_groups" {
  description = "Log groups of the functions that log through apps/api/src/log.ts; each `error` line counts toward the alarm."
  type        = map(string)
}
