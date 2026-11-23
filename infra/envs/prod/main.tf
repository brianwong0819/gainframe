terraform {
  backend "s3" {
    bucket       = "gainframe-tfstate"
    key          = "prod/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "ap-southeast-1"

  default_tags {
    tags = {
      project    = "gainframe"
      env        = "prod"
      managed_by = "terraform"
    }
  }
}

variable "release" {
  description = "Git SHA of the build being deployed; CD passes it, a local run reports `local`."
  type        = string
  default     = "local"
}

locals {
  name = "gainframe-prod"
}

module "api" {
  source = "../../modules/api"

  name               = local.name
  ssm_prefix         = "/gainframe/prod"
  source_dir         = "${path.root}/../../../apps/api/dist/lambda"
  log_retention_days = 30
  release            = var.release
}

module "site" {
  source = "../../modules/site"

  name              = local.name
  api_function_name = module.api.function_name
  api_function_url  = module.api.function_url
  dev_pages         = false
}

module "auth" {
  source = "../../modules/auth"

  name       = local.name
  ssm_prefix = "/gainframe/prod"

  pre_sign_up_source_dir = "${path.root}/../../../apps/api/dist/pre-sign-up"
  log_retention_days     = 30
  release                = var.release

  # The sign-in page is the redirect URI and Settings the sign-out target
  # (ADR-0007). Unlike dev, no localhost URLs: local development signs in
  # against dev.
  callback_urls = ["https://${module.site.domain_name}/settings/sign-in"]
  logout_urls   = ["https://${module.site.domain_name}/settings"]
}
