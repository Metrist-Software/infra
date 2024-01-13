# Orchestrator Terraform code

This subdirectory contains Terraform code that deploys Orchestrator outside our main infra. Note that it assumes you have
these cloud-specific tools installed in addition to the `terraform` executable:

* [`gcloud`](https://cloud.google.com/sdk/docs/install)
* [`az`](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-windows?tabs=azure-cli)

## Notes on GCP

We're splitting things up in two stacks:

* `gcp-infra` contains the network, cluster definition;
* `gcp-deploy` contains the K8s deployment/configuration.

There is currently no way in Terraform to reliably create a K8s cluster and deploy to it at the same time; not even
Hashicorp's example code works. Rather than digging around, we take this multi-step approach. This also allows you
to prep infra everywere (which takes a long time) and then roll-out Orchestrator one-by-one.

An Azure (and maybe-one-day AWS/EKS) deploy probably needs to follow the same strategy.

## Access

### AWS

    $ aws sso login

### GCP

    $ gcloud init
    $ gcloud auth application-default login

### Azure

    $ az login
