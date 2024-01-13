#!/usr/bin/env bash

# Builds the error handler lambda zip package and uploads it to
# s3. This deploy will send up error-handler-{env}.zip
#
# This script will also update the lambda in the env region unless no_lambda_update is passed
#
# Arguments:
# prod/dev/<any> - will determine the region and env var
# if anything other than prod/dev is passed then the second param needs to be a region and the third param an s3 bucket name (allows for simple sandbox testing)
# no_lambda_update (as last argument) - will cause the script not to issue a lambda code update

set -eo pipefail

baseDir=$(cd $(dirname $0); pwd)

no_lambda_update=false
# Terraform s3 buckets must reside in the same region as where they are being deployed.
# This is why we have environment suffixed buckets.
# See https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function#s3_bucket
case "$1" in
    prod)
        env="prod"
        region="us-west-2"
        bucket="metrist-private-lambdas-prod"
        ;;
    dev1)
        env="dev1"
        region="us-east-1"
        bucket="metrist-private-lambdas-dev1"
        ;;
    *)
        env="$1"
        region="$2"
        bucket="$3"
        ;;
esac

if [ "${@: -1}" = "no_lambda_update" ]; then
    echo "Not pushing lambda updates on this run"
    no_lambda_update=true
fi

s3_upload() {
    for i in $@; do
        echo "Uploading $i"
        aws s3 cp "$i" s3://${bucket}/;
    done
}

update_function() {
    lambda_function="$env-backend-error-handler-lambda"
    zipfile="fileb://$1"
    echo "Updating function $lambda_function with $zipfile in region $region"
    aws lambda update-function-code --function-name  $lambda_function --zip-file $zipfile --region $region --no-cli-pager
    echo "Waiting on $lambda_function deploy"
    aws lambda wait function-updated --function-name $lambda_function --region $region --no-cli-pager
}

package_error_handler() {
    echo "=== Packaging error logging lambda..."
    target=$PWD
    make clean
    make build

    zip_file_name=error-handler-$env.zip

    cd dist
    zip -r $zip_file_name .

    s3_upload $target/dist/$zip_file_name

    if [ "$no_lambda_update" = false ]; then
        update_function $zip_file_name
    fi
}

cd "$baseDir"
package_error_handler
echo "All done!"
