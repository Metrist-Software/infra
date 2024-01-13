variable "env_to_main_account_aws_region_map" {
  type = map(string)
  default = {
    "dev1" = "us-east-1"
    "prod" = "us-west-2"
  }
}

variable "env" {
  type = string
}

variable "region" {
  type = string
}

locals {
  name_prefix = "orch-${var.env}-${var.region}"
  # Manually map regions -> AZs, because especially in the old
  # ones (east/west 1) not everything is always available.
  azs = {
    "us-west-1"    = "us-west-1a"
    "us-west-2"    = "us-west-2b"
    "us-east-1"    = "us-east-1a"
    "us-east-2"    = "us-east-2a"
    "ca-central-1" = "ca-central-1a"
  }
  main_account_aws_region = var.env_to_main_account_aws_region_map[var.env]
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags = {
    Name = local.name_prefix
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  availability_zone       = local.azs[var.region]
  cidr_block              = "10.0.0.0/24"
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-public"
  }
}

resource "aws_subnet" "private" {
  vpc_id                  = aws_vpc.main.id
  availability_zone       = local.azs[var.region]
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name_prefix}-private"
  }
}

resource "aws_internet_gateway" "ig" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = local.name_prefix
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "${local.name_prefix}-public"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "${local.name_prefix}-private"
  }
}

resource "aws_eip" "nat_eip" {
  vpc        = true
  depends_on = [aws_internet_gateway.ig]

  tags = {
    Name = local.name_prefix
  }
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat_eip.id
  subnet_id     = aws_subnet.public.id
  depends_on    = [aws_internet_gateway.ig]
}

resource "aws_route" "public_internet_gateway" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.ig.id
}
resource "aws_route" "private_nat_gateway" {
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.nat.id
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}
resource "aws_route_table_association" "private" {
  subnet_id      = aws_subnet.private.id
  route_table_id = aws_route_table.private.id
}

module "orchestrator_user" {
  providers = {
    aws = aws.main
  }
  source   = "../../../modules/orchestrator_user"
  env      = var.env
  region   = var.region
  platform = "aws"
  logs_arn = data.aws_cloudwatch_log_group.logs.arn
}

module "init_script" {
  providers = {
    aws = aws.main
  }
  source                    = "../../../modules/cloudinit_script"
  env                       = var.env
  region                    = var.region
  aws_region                = local.main_account_aws_region
  platform                  = "aws"
  aws_access_key_id         = module.orchestrator_user.aws_access_key_id
  aws_secret_access_key     = module.orchestrator_user.aws_secret_access_key
  run_group_override        = "aws,aws:${var.region}"
  additional_pre_run_script = <<EOF
  sudo snap install amazon-ssm-agent --classic
  sudo snap start amazon-ssm-agent
  EOF
}

resource "aws_network_interface" "main" {
  subnet_id         = aws_subnet.private.id
  private_ips_count = 1

  tags = {
    Name = local.name_prefix
  }
}

# Instance profile to allow SSM connect through the EC2 console.
resource "aws_iam_role" "instance_profile_role" {
  name                = "${local.name_prefix}-instance-role"
  path                = "/"
  managed_policy_arns = ["arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"]
  assume_role_policy  = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": "sts:AssumeRole",
            "Principal": {
               "Service": "ec2.amazonaws.com"
            },
            "Effect": "Allow",
            "Sid": ""
        }
    ]
}
EOF
}

resource "aws_iam_instance_profile" "instance_profile" {
  name_prefix = "orch-${local.name_prefix}-iprof"
  role        = aws_iam_role.instance_profile_role.name
}

data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-20220606"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["099720109477"] # Canonical
}

data "aws_cloudwatch_log_group" "logs" {
  provider = aws.main

  # Name must match what Sup expects and what we have in infra
  name = "${var.env}-orchestrator-logs"
}

resource "aws_instance" "main" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = "c6i.xlarge"
  user_data                   = module.init_script.script
  user_data_replace_on_change = true
  iam_instance_profile        = aws_iam_instance_profile.instance_profile.name
  availability_zone           = local.azs[var.region]

  root_block_device {
    volume_size = 25
  }

  tags = {
    Name = local.name_prefix
  }

  network_interface {
    network_interface_id = aws_network_interface.main.id
    device_index         = 0
  }

  metadata_options {
    http_endpoint          = "enabled"
    instance_metadata_tags = "enabled"
  }
}
