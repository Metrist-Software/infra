# Maybe change - Sup can expand SSM parameters but then the user needs
# access. The difference is then that SSM parameters get re-read on
# an orchestrator deploy, making it possible to update everything on the fly.
# Note the use of "difference" - this can be an advantage or not, we could
# upgrade everything on the fly and also crash everything on the fly. Keep it "manual"
# for now.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.54"
    }
  }
}

data "aws_ssm_parameter" "app_api" {
  name = "/${var.env}/apiEndpoints/appAPI"
}

data "aws_ssm_parameter" "telemetry_api" {
  name = "/${var.env}/apiEndpoints/telemetryAPI"
}

# FIXME? In AWS, this is set per region, here we grab it per env. Should not hurt right now.
data "aws_ssm_parameter" "cleanup_enabled" {
  name = "/${var.env}/monitors/enableCleanup"
}

data "aws_ssm_parameter" "slack_alerting_channel" {
  name = "/${var.env}/internal/opsChannel"
}

# This secret is required by the EC2 cloudinit to exist
data "aws_secretsmanager_secret" "api_token" {
  name = "/${var.env}/canary-shared/api-token"
}

data "aws_secretsmanager_secret" "slack_api_token" {
  name = "/${var.env}/slack/api-token"
}