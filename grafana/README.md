# Grafana instance setup

This folder contains a fully isolated cdk codebase to spin up a grafana instance in AWS in a specified account/region

Our on prem Grafana does not operate in "Envs" like our main codebase so there is no ENVIRONMENT_TAG needed here. You simply provide the region/account you want to deploy to.

## Typical prod install in our main account
`GRAFANA_INSTALL_REGION=us-west-2 make apply`

## Typical dev install in our main account
`make apply

## Example of running against a different account
You must override the state location as s3 buckets need to be globally unique. The example below deploys this to the metrist-sandbox. When doing this, be aware that you have to
validate the certificate that it tries to create the first time through DNS validation. If you are installing on our main account it should do that automatically.

DynamoDB table needs LockID (String) as its partition key

`GRAFANA_INSTALL_AWS_ACCOUNT_ID=046400679278 AWS_PROFILE=metrist-sandbox GRAFANA_INSTALL_OVERRIDE_STATE_LOCATION=cdktf-grafana-infra-sandbox make apply`

## Other config env vars
- GRAFANA_INSTALL_SUBDOMAIN (defaults to `grafana`)
- GRAFANA_INSTALL_REGION (defaults to `us-east-1`)
- GRAFANA_INSTALL_AWS_ACCOUNT_ID (defaults to our main account `123456789`)
- GRAFANA_INSTALL_OVERRIDE_STATE_LOCATION (defaults to `cdktf-grafana-infra`)

## Other notes
s3 bucket and dynamo DB table must exists in `us-west-2` within whatever account is being targeted prior to running `terraform init`. Default name is `cdktf-grafana-infra` for both.

The admin password is randomly generated and will be stored in the `/prod/grafana/admin-pass` secret in whatever region it is deploying to
Serial pass for ubuntu user is stored in the `/prod/grafana/serial-pass` secret

Script expects a secret to exists in the install region named `/prod/grafana/secrets` with the following values: `tailscale_secret`, `google_client_id`, `google_client_secret`

After deployment, auto_oauth login is turned on. To access the normal login page to log in as admin and promote a Google user use `https://<subdomain>.metrist.io/login?disableAutoLogin`.

The default subdomain is `grafana` but it can be overriden with the `GRAFANA_INSTALL_SUBDOMAIN` env var which will change the root_url config value and the cert that will be generated.

