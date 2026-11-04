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
}
