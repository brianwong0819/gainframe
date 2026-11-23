variable "name" {
  description = "Resource name prefix, gainframe-<env>; also the managed login domain prefix."
  type        = string
}

variable "callback_urls" {
  description = "Pages managed login and Google may redirect back to with an authorization code."
  type        = list(string)
}

variable "logout_urls" {
  description = "Pages the logout endpoint may redirect back to after signing out."
  type        = list(string)
}

variable "ssm_prefix" {
  description = "SSM Parameter Store path for this environment, /gainframe/<env>; the API reads the auth settings there."
  type        = string
}

variable "pre_sign_up_source_dir" {
  description = "Directory with the bundled pre sign-up trigger (apps/api/dist/pre-sign-up)."
  type        = string
}

variable "log_retention_days" {
  description = "Days to keep the pre sign-up trigger's logs."
  type        = number
}

variable "release" {
  description = "Git SHA of the build being deployed, logged by the trigger."
  type        = string
}

variable "api_role_name" {
  description = "The API function's role, which may delete users of this pool (DELETE /api/account)."
  type        = string
}
