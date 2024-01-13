terraform {
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

variable "region" {
  description = "Target platform region"
  type = string
}

variable "platform" {
  description = "Platform type (aws, gcp, azure, ...)"
  type = string
}

variable "account_id" {
  type = string
  default = "123456789"
}

variable "logs_arn" {
  type = string
}

resource "aws_iam_user" "orchestratoruser" {
  name = "${var.platform}-${var.env}-${var.region}-orch"
  path = "/OrchestratorUsers/"
}

resource "aws_iam_access_key" "orchestratoruser" {
  user = aws_iam_user.orchestratoruser.name
}

#
#  This user is shared by Orchestrator and Sup.
#  - Orchestrator can expand secrets on behalf of monitors and therefore needs access to Secrets Manager
#  - Sup needs to read our (private) S3 bucket where we keep latest version stamps.
#  - We want to send logs to Cloudwatch.
resource "aws_iam_user_policy" "orchestratoruser" {
  name = "${var.platform}-${var.env}-${var.region}-orch"
  user = aws_iam_user.orchestratoruser.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetResourcePolicy"
        ]
        Resource = [
          # Note that we allow all regions for now. It's probably easiest to one day tag all secrets with env
          # and allow access by tag, which should be simpler once we're off CloudFormation. Another solution
          # might be to map env/region/platform to specific secrets regions but that's probably tricky in Terraform.
          # For now, this is fine.
          "arn:aws:secretsmanager:*:${var.account_id}:secret:/${var.env}/*"
        ]
        Effect = "Allow"
      },
      {
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "arn:aws:s3:::canary-private/version-stamps/*"
        ]
        Effect = "Allow"
      },
      {
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "${var.logs_arn}:*"
        ]
        Effect = "Allow"
      },
      # Needed for terraform monitors
      {
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem"
        ]
        Resource = [
          "arn:aws:dynamodb:us-west-2:123456789:table/cmtf-infra"
        ]
        Effect = "Allow"
      },
      {
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "arn:aws:s3:::cmtf-infra/terraform/*"
        ]
        Effect = "Allow"
      },
      {
        "Effect": "Allow",
        "Action": "s3:ListBucket",
        "Resource": "arn:aws:s3:::cmtf-infra"
      }      
    ]

  })
}

# We stash the keypair in secrets a) to have everything centrally there in case manual access
# is needed, and b) to have things ready to roll for AWS.

resource "aws_secretsmanager_secret" "secret" {
  name = "/${var.env}/orchestrator/${var.platform}/${var.region}"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "current" {
  secret_id = aws_secretsmanager_secret.secret.id
  secret_string = jsonencode({
    aws_access_key_id = aws_iam_access_key.orchestratoruser.id
    // TODO - use a PGP key instead? This causes the secret to be written
    // to the statefile in S3, which is secure enough but technically an
    // unnecessary extra copy.
    aws_secret_access_key = aws_iam_access_key.orchestratoruser.secret
  })
}

output "aws_access_key_id" {
  value = aws_iam_access_key.orchestratoruser.id
}

output "aws_secret_access_key" {
  value = aws_iam_access_key.orchestratoruser.secret
}
