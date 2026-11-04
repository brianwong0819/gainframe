provider "aws" {
  region = "ap-southeast-1"

  default_tags {
    tags = {
      project    = "gainframe"
      env        = "shared"
      managed_by = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  # GitHub issues OIDC subjects in the immutable form <owner>@<owner id>/<repo>@<repo id>,
  # so a repository deleted and recreated under the same name cannot assume the roles.
  github_repository = "brianwong0819@59221587/gainframe@1439499232"
}
