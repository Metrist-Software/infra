#!/usr/bin/env bash
#
#  Deploy Orchestrator to a platform/environment combination
#
#  The default is to apply everything, but you can pass "destroy" to reverse that.
#
platform=$1; shift
env=$1; shift

case "$1" in
destroy)
    action=destroy
    ;;
*)
    action=apply
    ;;
esac

set -e

base=$(
    cd $(dirname $0)/..
    /bin/pwd
)

case "$platform:$env" in
aws:dev1)
    regions=(us-east-1)
    ;;
aws:prod)
    regions=(us-east-2)
    ;;
gcp:dev1)
    regions=(us-west1)
    ;;
gcp:prod)
    regions=(us-central1)
    ;;
az:dev1)
    regions=(eastus)
    ;;
az:prod)
    regions=(eastus)
    ;;
esac

echo "Deploy Orchestrator to $platform env $env, regions are $regions"

deploy_region() {
    region=$1
    echo =========================== Deploy infra for $env/$platform to region $region
    cd $base/stacks/$platform/instance
    rm -f .terraform/terraform.tfstate
    terraform init -backend-config="key=terraform/orchestrator/$env/$platform/$region/infra.statefile"
    terraform $action -var env="$env" -var region="$region" -auto-approve
}

deploy_regions() {
    for region in "${regions[@]}"; do
        deploy_region "$region"
    done
}

deploy_platform_shared() {
    if [ -f $base/stacks/$platform/shared/main.tf ]; then
        echo =========================== Deploy shared infra for $env/$platform
        cd $base/stacks/$platform/shared
        rm -f .terraform/terraform.tfstate
        terraform init -backend-config="key=terraform/orchestrator/$env/$platform/infra.statefile"
        terraform $action -var env=$env -auto-approve
    fi
}

deploy_shared() {
    echo =========================== Deploy shared infra for $env
    cd $base/stacks/shared
    rm -f .terraform/terraform.tfstate
    terraform init -backend-config="key=terraform/orchestrator/$env/infra.statefile"
    terraform $action -var env=$env -auto-approve
}

if [ $action = "apply" ]; then
    deploy_shared
    deploy_platform_shared
    deploy_regions
else
    deploy_regions
    # We share infra with multiple stacks, so just destroying them here does not seem like a good idea. Conceptually,
    # the order needs to be reversed so keeping the code like this for now, mostly to document the procedure. The
    # actual destroy action should be done manually though when needed.
    # deploy_platform_shared
    # deploy_shared
fi
