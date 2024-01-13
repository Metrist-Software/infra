# Google shares a single VPC globally.

terraform {
  backend "s3" {
    bucket         = "cmtf-infra"
    region         = "us-west-2"
    // The key is variable, so we set it on `terraform init`
  }
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.53.1"
    }
  }
}

variable "env" {
  type = string
}

locals {
  vpc_name = "orch-${var.env}"
}

provider "google" {
  project = "cm-monitors"
}

resource "google_compute_network" "vpc" {
  name                    = local.vpc_name
  auto_create_subnetworks = "false"
}

resource "google_compute_firewall" "firewall" {
  name = local.vpc_name
  network = google_compute_network.vpc.name

  # Allow IAP ssh ingress so we can access instances from the GCP console
  allow {
    protocol = "tcp"
    ports = ["22"]
  }
  source_ranges = ["35.235.240.0/20"]
}

resource "google_service_account" "default" {
  account_id   = local.vpc_name
  display_name = "Service Account for Orchestrator in ${var.env}"
}
