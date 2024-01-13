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
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

variable "env" {
  type = string
}

variable "region" {
  type = string
}

variable "env_to_region_map" {
  type = map(string)
  default = {
    "dev1" = "us-east-1"
    "prod" = "us-west-2"
  }
}

variable "region_to_cidr_map" {
  # The actual ranges don't really matter, this is just an easy way
  # to assign unique networks and at the same time a quick overview of
  # what was assigned.
  type = map(string)
  default = {
    "us-west1"                = "1"
    "us-west2"                = "2"
    "us-west3"                = "3"
    "us-west4"                = "4"
    "us-central1"             = "5"
    "us-east1"                = "6"
    "us-east4"                = "7"
    "northamerica-northeast1" = "8"
    "northamerica-northeast2" = "9"
  }
}

locals {
  cluster_name = "orch-${var.env}-${var.region}"
  aws_region   = lookup(var.env_to_region_map, var.env)
}

provider "google" {
  project = "cm-monitors"
  region  = var.region
}

provider "aws" {
  region = local.aws_region
}

data "google_client_config" "default" {
}

data "aws_cloudwatch_log_group" "logs" {
  # Name must match what Sup expects and what we have in infra
  name = "${var.env}-orchestrator-logs"
}

module "orchestrator_user" {
  source   = "../../../modules/orchestrator_user"
  env      = var.env
  region   = var.region
  platform = "gcp"
  logs_arn = data.aws_cloudwatch_log_group.logs.arn
}

module "init_script" {
  source                = "../../../modules/cloudinit_script"
  env                   = var.env
  region                = var.region
  aws_region            = local.aws_region
  platform              = "gcp"
  aws_access_key_id     = module.orchestrator_user.aws_access_key_id
  aws_secret_access_key = module.orchestrator_user.aws_secret_access_key
  additional_orch_env_vars = {
    GCP_ZONE   = data.google_compute_zones.available_zones.names.0
  }
}

data "google_compute_network" "vpc" {
  name = "orch-${var.env}"
}

resource "google_compute_subnetwork" "subnet" {
  name          = data.google_compute_network.vpc.name
  region        = var.region
  network       = data.google_compute_network.vpc.name
  ip_cidr_range = "10.${lookup(var.region_to_cidr_map, var.region)}.0.0/24"
}

data "google_service_account" "default" {
  account_id = "orch-${var.env}"
}

data "google_compute_zones" "available_zones" {
  status = "UP"
}

resource "google_compute_instance" "default" {
  name                      = local.cluster_name
  machine_type              = "e2-standard-2"
  zone                      = data.google_compute_zones.available_zones.names.0
  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = "ubuntu-2004-lts"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.subnet.name
    access_config {

    }
  }

  metadata_startup_script = module.init_script.script

  service_account {
    email  = data.google_service_account.default.email
    scopes = ["cloud-platform"]
  }
}
