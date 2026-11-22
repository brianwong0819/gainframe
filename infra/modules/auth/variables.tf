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
