output "script" {
  value = <<CUSTOM_DATA
#!/bin/bash

set -vx

#
# Install some basics
#
apt-get update
apt-get install -y docker.io unzip wget curl jq

#
# Install and start orchestrator and eBPF plugin.
# We're running this second orchestrator as a sort of private
# discovery monitor, sending to a different account than the
# actual orchestrator. This way we can keep the two datasets
# separate.
#
orch_cma_config=/etc/metrist-orchestrator/cma-config.yaml
mkdir -p $(dirname $orch_cma_config)
cat <<EOF >$orch_cma_config
patterns:
  gke.RemoveDeployment:
    method: DELETE
    host: 34.86.*
    url: /apis/apps/v1/namespaces/default/deployments/gke-monitor.*
  gke.GetPods:
    method: GET
    host: 34.86.*
    url: /api/v1/namespaces/default/pods.*gke-monitor.*
  gke.CreateDeployment:
    method: POST
    host: 34.86.*
    url: /apis/apps/v1/namespaces/default/deployments
  awseks.RemoveDeployment:
    method: DELETE
    host: .*.eks.amazonaws.com
  awseks.GetPods:
    method: GET
    host: .*.eks.amazonaws.com
    url: /api/v1/namespaces/default/pods.*
  awseks.CreateDeployment:
    method: POST
    host: .*.eks.amazonaws.com
    url: /apis/apps/v1/namespaces/default/deployments
  moneris.PostRequest:
    method: POST
    host: .*.moneris.com
  bambora.TestPurchase:
    method: POST
    host: api.na.bambora.com
    url: /v1/payments
  bambora.TestRefund:
    method: POST
    host: api.na.bambora.com
    url: /v1/payments/.*/returns
  bambora.TestVoid:
    method: POST
    host: api.na.bambora.com
    url: /v1/payments/.*/void
  nuget.ListVersions:
    method: GET
    host: api.nuget.org
  pagerduty.GetExtensions:
    method: GET
    host: api.pagerduty.com
    url: /extensions.*
  pagerduty.GetIncidents:
    method: GET
    host: api.pagerduty.com
    url: /incidents.*
  trello.GetCards:
    method: GET
    host: api.trello.com
    url: 1/lists/.*/cards.*
  jira.Search:
    method: GET
    host: canary-monitoring.atlassian.net
    url: /rest/api/2/search.*
  zendesk.Search:
    method: GET
    host: canary-monitoring.zendesk.com
    url: /api/v2/search.json.*
  awscloudfront.CreateInvalidation:
    method: POST
    host: cloudfront.amazonaws.com
    url: 2020-05-31/distribution/.*/invalidation
EOF
cd /tmp
orch_latest=$(curl http://dist.metrist.io/orchestrator/ubuntu/20.04.x86_64.latest.txt)
wget http://dist.metrist.io/orchestrator/ubuntu/$orch_latest
ebpf_latest=$(curl http://dist.metrist.io/orchestrator-plugins/ebpf/ubuntu/20.04.x86_64.latest.txt)
wget http://dist.metrist.io/orchestrator-plugins/ebpf/ubuntu/$ebpf_latest
apt-get install -y ./metrist*.deb

api_key=$(aws secretsmanager get-secret-value --region ${var.region} --secret-id /${var.env}/private-cma/canary-api-token | jq -r '.SecretString'|jq -r '.token')
cat <<EOF >>/etc/default/metrist-orchestrator
METRIST_INSTANCE_ID=backend-${var.env}-${var.platform}-${var.region}
METRIST_RUN_GROUPS=none
METRIST_API_TOKEN=$api_key
METRIST_API_HOST=${data.aws_ssm_parameter.app_api.value}
METRIST_IPA_SERVER_PORT=51713
METRIST_CMA_CONFIG=$orch_cma_config
EOF

cat <<EOF >/etc/default/metrist-orchestrator-ebpf-plugin
METRIST_ORCHESTRATOR_ENDPOINT=127.0.0.1:51713
EOF

for i in metrist-orchestrator metrist-orchestrator-ebpf-plugin; do
  systemctl enable $i
  systemctl start $i
done

#
# Install and start Sup
#
mkdir -p /var/lib/sup /var/run/sup

cat <<EOT >>/var/lib/sup/orchestrator.env
METRIST_INSTANCE_ID=${var.platform}:${var.region}
METRIST_RUN_GROUPS=${local.run_groups}
METRIST_API_TOKEN=@secret@:/${var.env}/canary-shared/api-token#token
METRIST_API_HOST=${data.aws_ssm_parameter.app_api.value}
METRIST_TELEMETRY_HOST=${data.aws_ssm_parameter.telemetry_api.value}
METRIST_WEBHOOK_HOST=${data.aws_ssm_parameter.telemetry_api.value}
${var.env != "prod" ? "METRIST_PREVIEW_MODE=true" : ""}
ENVIRONMENT_TAG=${var.env}
METRIST_CLEANUP_ENABLED=${data.aws_ssm_parameter.cleanup_enabled.value}
SLACK_ALERTING_CHANNEL=${data.aws_ssm_parameter.slack_alerting_channel.value}
SLACK_API_TOKEN=@secret@:/${var.env}/slack/api-token#token
METRIST_MONITOR_RUNNING_ALERT_WEBHOOK_URL=https://${data.aws_ssm_parameter.app_api.value}/api/agent/monitor-alert
METRIST_MONITOR_RUNNING_ALERT_WEBHOOK_TOKEN=@secret@:/${var.env}/canary-shared/api-token#token
AWS_ACCESS_KEY_ID=${var.aws_access_key_id}
AWS_SECRET_ACCESS_KEY=${var.aws_secret_access_key}
AWS_BACKEND_REGION=${var.aws_region}
CLOUD_PLATFORM=${var.platform}
METRIST_ENABLE_HOST_TELEMETRY=true
ORCHESTRATOR_REGION=${var.region}
${local.additional_orch_env_vars}
EOT

# Set the AWS credentials for the CloudWatch logger in the Docker daemon.
mkdir /etc/systemd/system/docker.service.d
cat << EOT >>/etc/systemd/system/docker.service.d/aws-logging.conf
[Service]
Environment="AWS_ACCESS_KEY_ID=${var.aws_access_key_id}"
Environment="AWS_SECRET_ACCESS_KEY=${var.aws_secret_access_key}"
Environment="AWS_REGION=${var.aws_region}"
EOT
sudo systemctl daemon-reload
sudo systemctl restart docker

# Install the AWS CLI (Sup uses that to create new log groups)
cd /tmp
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

${var.additional_pre_run_script}

# Finally, create and run the 'supgrade' script.
cat <<EOT >>/usr/local/bin/supgrade
#!/bin/sh
docker pull canarymonitor/sup:latest
docker stop sup
docker rm sup
docker run -d \
  --restart unless-stopped \
  --network host \
  --name sup \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /var/run/sup:/var/run/sup \
  -v /var/lib/sup:/var/lib/sup \
  -v /usr/local:/usr/local \
  -e CLOUD_PLATFORM=${var.platform} \
  -e ENVIRONMENT_TAG="${var.env}" \
  -e AWS_REGION="${var.aws_region}" \
  -e AWS_ACCESS_KEY_ID="${var.aws_access_key_id}" \
  -e AWS_SECRET_ACCESS_KEY="${var.aws_secret_access_key}" \
  -e INSTANCE_ID="${var.platform}:${var.region}" \
  -e SUP_SUBSYSTEM=orchestrator \
  -e SUP_VERSION_BUCKET=dist.metrist.io \
  -e SUP_VERSION_PATH=orchestrator/docker \
  canarymonitor/sup:latest
EOT
chmod +x /usr/local/bin/supgrade
/usr/local/bin/supgrade

CUSTOM_DATA
}
