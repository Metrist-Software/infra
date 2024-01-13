terraform {
  backend "s3" {
    bucket = "cmtf-infra"
    region = "us-west-2"
    // The key is variable, so we set it on `terraform init`
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.54"
    }
  }
}

provider "aws" {
  profile             = "metrist-monitoring"
  region              = var.region
  allowed_account_ids = ["907343345003"]
}

provider "aws" {
  alias               = "main" # Canary Monitoring Inc. account
  region              = local.main_account_aws_region
  allowed_account_ids = ["123456789"]
}
