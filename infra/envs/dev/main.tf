terraform {
  backend "s3" {
    bucket       = "gainframe-tfstate"
    key          = "dev/terraform.tfstate"
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
      env        = "dev"
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
  name = "gainframe-dev"
}

module "api" {
  source = "../../modules/api"

  name               = local.name
  ssm_prefix         = "/gainframe/dev"
  source_dir         = "${path.root}/../../../apps/api/dist/lambda"
  log_retention_days = 14
  release            = var.release
}

module "site" {
  source = "../../modules/site"

  name              = local.name
  api_function_name = module.api.function_name
  api_function_url  = module.api.function_url
  # The dev deploy builds with GAINFRAME_DEV_PAGES=1.
  dev_pages = true
}

module "auth" {
  source = "../../modules/auth"

  name          = local.name
  ssm_prefix    = "/gainframe/dev"
  api_role_name = module.api.role_name

  pre_sign_up_source_dir = "${path.root}/../../../apps/api/dist/pre-sign-up"
  log_retention_days     = 14
  release                = var.release

  # The sign-in page is the redirect URI and Settings the sign-out target
  # (ADR-0007).
  callback_urls = [
    "https://${module.site.domain_name}/settings/sign-in",
    "http://localhost:3000/settings/sign-in",
  ]
  logout_urls = [
    "https://${module.site.domain_name}/settings",
    "http://localhost:3000/settings",
  ]
}

module "monitoring" {
  source = "../../modules/monitoring"

  name              = local.name
  api_function_name = module.api.function_name
  log_groups = {
    api         = module.api.log_group
    pre-sign-up = module.auth.pre_sign_up_log_group
  }
}
