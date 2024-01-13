variable "env" {
  type = string
}

variable "region" {
  type        = string
  description = "Region of a specific cloud platform"
}

variable "platform" {
  type        = string
  description = "Options: aws, az and gcp"
}

variable "aws_region" {
  type = string
}

variable "aws_access_key_id" {
  type = string
}

variable "aws_secret_access_key" {
  type = string
}

variable "additional_orch_env_vars" {
  type        = map(string)
  description = <<EOF
    (optional) A map of additional environment variables

    Example

    {
        GCP_REGION  = "region"
        GCP_ZONE    = "zone"
    }
    EOF
  default     = {}
}

variable "additional_pre_run_script" {
  type        = string
  default     = ""
  description = "Script that will be executed before supgrade call"
}

variable "run_group_override" {
  type    = string
  default = ""
}

locals {
  default_run_groups = "${var.platform},${var.platform}:${var.region},${var.platform}:${var.env},${var.platform}:${var.env}/${var.region}"
  additional_orch_env_vars = join("\n",
    formatlist("%s=%s", keys(var.additional_orch_env_vars), values(var.additional_orch_env_vars))
  )
  run_groups = coalesce(var.run_group_override, local.default_run_groups)
}
