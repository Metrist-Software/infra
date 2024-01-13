terraform {
  backend "s3" {
    bucket         = "cmtf-infra"
    region         = "us-west-2"
    // The key is variable, so we set it on `terraform init`
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.54"
    }
  }
}

variable "env" {
  description = "Platform stage (dev1, prod)"
  type = string
}

variable "env_to_region_map" {
  type = map(string)
  default = {
    "dev1" = "us-east-1"
    "prod" = "us-west-2"
  }
}

provider "aws" {
  region = lookup(var.env_to_region_map, var.env)
}

# Has to match what Sup expects
resource "aws_cloudwatch_log_group" "logs" {
  name = "${var.env}-orchestrator-logs"
  retention_in_days = 90
}
