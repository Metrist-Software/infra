variable "env" {
  type = string
}

variable "region" {
  type = string
}

variable "env_to_aws_region_map" {
  type = map(string)
  default = {
    "dev1" = "us-east-1"
    "prod" = "us-west-2"
  }
}

locals {
  aws_region = var.env_to_aws_region_map[var.env]
  prefix = "orch-${var.env}-${var.region}"
}
