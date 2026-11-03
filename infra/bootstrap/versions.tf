terraform {
  required_version = "~> 1.16"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.70"
    }
  }

  # State lives in the bucket this stack creates. The first apply runs with a
  # local backend override and then migrates the state here (see README.md).
  backend "s3" {
    bucket       = "gainframe-tfstate"
    key          = "bootstrap/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }
}
