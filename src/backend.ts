import { BaseModule } from './base_module'
import { Context } from '../main'
import { Token } from 'cdktf'
import { Instance } from "../.gen/providers/aws/instance"
import { Vpc } from "../.gen/providers/aws/vpc"
import { Alb } from "../.gen/providers/aws/alb"
import { InternetGateway } from "../.gen/providers/aws/internet-gateway"
import { Subnet } from "../.gen/providers/aws/subnet"
import { DataAwsAmi } from "../.gen/providers/aws/data-aws-ami"
import { SecurityGroup } from "../.gen/providers/aws/security-group"
import { IamInstanceProfile } from "../.gen/providers/aws/iam-instance-profile"
import { IamRole } from "../.gen/providers/aws/iam-role"
import { SecurityGroupRule } from "../.gen/providers/aws/security-group-rule"
import { AlbListener } from "../.gen/providers/aws/alb-listener"
import { AlbTargetGroup } from "../.gen/providers/aws/alb-target-group"
import { AlbTargetGroupAttachment } from "../.gen/providers/aws/alb-target-group-attachment"
import { AcmCertificate } from "../.gen/providers/aws/acm-certificate"
import { SecretsmanagerSecret } from "../.gen/providers/aws/secretsmanager-secret"
import { SecretsmanagerSecretVersion } from "../.gen/providers/aws/secretsmanager-secret-version"
import { DefaultRouteTable } from "../.gen/providers/aws/default-route-table"
import { Route53Record } from "../.gen/providers/aws/route53-record"
import { CloudwatchLogGroup } from "../.gen/providers/aws/cloudwatch-log-group"
import { AlbListenerRule } from "../.gen/providers/aws/alb-listener-rule"
import { AlbListenerCertificate } from "../.gen/providers/aws/alb-listener-certificate"
import { DataAwsSsmParameter } from "../.gen/providers/aws/data-aws-ssm-parameter"
import { DataAwsVpcPeeringConnection } from "../.gen/providers/aws/data-aws-vpc-peering-connection"
import { VpcPeeringConnection } from "../.gen/providers/aws/vpc-peering-connection"
import { DataAwsRouteTable } from "../.gen/providers/aws/data-aws-route-table"
import { Route } from "../.gen/providers/aws/route"
import { CloudwatchLogSubscriptionFilter } from "../.gen/providers/aws/cloudwatch-log-subscription-filter"
import { LambdaPermission } from "../.gen/providers/aws/lambda-permission"
import { LambdaFunction } from "../.gen/providers/aws/lambda-function"

import { Uuid } from '../.gen/providers/random/uuid'
import { Sleep } from '../.gen/providers/time/sleep'
import { azMapping, standardTags, accountId } from './common'
import { randomBytes } from 'crypto'
import { StandardVpc } from './standard_vpc';

interface Config {
  instanceCount: number,
  timescaleSubnet: string,
  rdsSubnet: string,
  rdsVpcId: string,
  instanceType: string
  lambdaVpcConfig: LambdaVpcConfig
}

interface LambdaVpcConfig {
  Cidr: string,
  PublicCidrs: string[],
  PrivateCidrs: string[]
}

const userData = `#!/bin/sh -vx
mkdir -p /home/ubuntu/.ssh
auth_keys=/home/ubuntu/.ssh/authorized_keys
cat <<EOF >>$auth_keys
EOF
chown ubuntu:ubuntu $auth_keys
chmod 600 $auth_keys
touch /tmp/init_done

# In case we need to fallback to console access
snap install amazon-ssm-agent --classic
snap start amazon-ssm-agent
`

const userPass = randomBytes(32).toString('hex')

const workerUserData = (bindings: Record<string, string>) => `${userData}
# Configure rsyslog
cat <<EOF > /etc/logrotate.d/rsyslog
/var/log/syslog
{
        maxsize 50M
        rotate 0
        hourly
        missingok
        notifempty
        compress
        postrotate
                /usr/lib/rsyslog/rsyslog-rotate
        endscript
}

/var/log/mail.info
/var/log/mail.warn
/var/log/mail.err
/var/log/mail.log
/var/log/daemon.log
/var/log/kern.log
/var/log/auth.log
/var/log/user.log
/var/log/lpr.log
/var/log/cron.log
/var/log/debug
/var/log/messages
{
        rotate 4
        weekly
        missingok
        notifempty
        compress
        delaycompress
        sharedscripts
        postrotate
                /usr/lib/rsyslog/rsyslog-rotate
        endscript
}
EOF

mkdir -p /etc/systemd/system/logrotate.timer.d
cat <<EOF > /etc/systemd/system/logrotate.timer.d/runhourly.conf
[Timer]
OnCalendar=
OnCalendar=hourly
AccuracySec=1s
EOF

sudo systemctl daemon-reload

curl -1sLf 'https://repositories.timber.io/public/vector/cfg/setup/bash.deb.sh' | sudo -E bash
sudo apt update
sudo apt install -y jq wget curl vector=0.27.1-1 docker.io

adduser ubuntu docker

# Install vector
mkdir /var/lib/vector
mkdir /etc/vector
mkdir -p /etc/systemd/system/vector.service.d
cat <<EOF >>/etc/systemd/system/vector.service.d/multi-config.conf
[Service]
User=root
Group=root
ExecStart=
ExecStart=/usr/bin/vector --config=/etc/vector/*.toml
ExecStartPre=
ExecStartPre=/usr/bin/vector validate /etc/vector/*.toml
ExecReload=
ExecReload=/usr/bin/vector validate /etc/vector/*.toml
EOF

cd /tmp

# Install sup
preview=${bindings.environment == "dev1" ? "-preview" : ""}
mkdir -p /var/lib/sup /var/run/sup
sup_latest=$(aws s3 cp --quiet s3://canary-private/version-stamps/metrist-sup-latest$preview.txt /dev/stdout)
aws s3 cp s3://canary-private/linux-packages/ubuntu/20.04/$sup_latest /tmp
sudo apt install -y /tmp/$sup_latest

# Create the sup env variables
cat <<EOF >> /etc/default/metrist-sup
ENVIRONMENT_TAG=${bindings.environment}
AWS_REGION=${bindings.region}
SUP_SUBSYSTEM=metrist-backend
LAUNCH_TYPE=package
HEALTH_CHECK=http://localhost:4000/internal/health
TARGET_GROUP_ARN=${bindings.targetGroupArn}
INSTANCE_ID=$(curl http://169.254.169.254/latest/meta-data/instance-id)
EOF

# Create the backend environment variable
cat <<EOF >>/var/lib/sup/metrist-backend.env
SECRETS_NAMESPACE=/${bindings.environment}/
ENVIRONMENT_TAG=${bindings.environment}
AWS_REGION=${bindings.region}
DEFAULT_FROM_EMAIL=@ssm@:/${bindings.environment}/email/defaultFromEmail
EVENT_STORE_POOL_SIZE=50
EOF

#
# Install and start orchestrator and eBPF plugin
#
orch_latest=$(curl http://dist.metrist.io/orchestrator/ubuntu/ubuntu-20.04.latest.txt)
wget http://dist.metrist.io/orchestrator/ubuntu/$orch_latest
ebpf_latest=$(curl http://dist.metrist.io/orchestrator-plugins/ebpf/ubuntu/ubuntu-20.04.latest.txt)
wget http://dist.metrist.io/orchestrator-plugins/ebpf/ubuntu/$ebpf_latest
apt install -y ./metrist*.deb

api_key=$(aws secretsmanager get-secret-value --region ${bindings.region} --secret-id /${bindings.environment}/private-cma/canary-api-token | jq -r '.SecretString'|jq -r '.token')
cat <<EOF >>/etc/default/metrist-orchestrator
# Orchestrator-specific
METRIST_INSTANCE_ID=backend-${bindings.environment}-${bindings.region}
METRIST_RUN_GROUPS=none
METRIST_API_TOKEN=$api_key
METRIST_API_HOST=${bindings.stage == "development" ? "app-dev1" : "app"}.metrist.io
# Our standard vars, see ADR#0015
ENVIRONMENT_TAG=${bindings.environment}
AWS_REGION=${bindings.region}
AWS_BACKEND_REGION=${bindings.region}
ORCHESTRATOR_REGION=${bindings.region}
CLOUD_PLATFORM=aws
EOF

for i in metrist-orchestrator metrist-orchestrator-ebpf-plugin vector metrist-sup; do
  systemctl enable $i
  systemctl start $i
done

echo ubuntu:${userPass} | chpasswd

### Configure local metrics
aws ecr get-login-password --region ${bindings.region} | sudo docker login --username AWS --password-stdin ${bindings.dockerRegistry}

sudo docker pull ${bindings.dockerRegistry}/lm-agent:latest
lm_secret=$(aws secretsmanager get-secret-value --region ${bindings.region} --secret-id /${bindings.environment}/local_metrics/credentials | jq -r '.SecretString')
sudo docker run \
  --name lm-agent \
  -e LM_ACCOUNT_ID=$(echo $lm_secret | jq -r '.account_id') \
  -e LM_API_KEY=$(echo $lm_secret| jq -r '.api_key') \
  -e LM_BACKEND_URL="${bindings.localMetricsBackendURL}" \
  -e LM_ENABLE_SEND_TELEMETRY_TO_BACKEND=true \
  -e LM_ENABLE_SCRAPE_PROMETHEUS_METRICS=true \
  -e LM_AGENT_DATA_DIR=/tmp/lm_agent \
  -e PORT="5000" \
  --network host \
  ${bindings.dockerRegistry}/lm-agent:latest
`

// Jump host also runs Grafana Agent (Prometheus) and a private instance of
// Orchestrator.
const jumpUserData = (bindings: Record<string, string>) => `${userData}
# Add Tailscale APT repos
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list

##
## Install the extra stuff we need.
##
cd /tmp
# Generic packages
sudo apt-get update
sudo apt-get install -y docker.io jq net-tools tailscale build-essential zstd git curl unzip wget
# Elixir/Erlang
wget https://packages.erlang-solutions.com/erlang-solutions_2.0_all.deb && sudo dpkg -i erlang-solutions_2.0_all.deb
sudo apt-get update
sudo apt-get install -y esl-erlang elixir
# Private orchestrator
orch_latest=$(curl https://dist.metrist.io/orchestrator/ubuntu/20.04.x86_64.latest.txt)
wget https://dist.metrist.io/orchestrator/ubuntu/$orch_latest
sudo apt install -y ./$orch_latest

##
## Configure and start Orchestrator.
##
key=$(
  aws secretsmanager get-secret-value --secret-id /${bindings.environment}/private-cma/canary-api-token |
    jq -r '.SecretString' |
    jq -r '.token')
cat <<EOF | sudo tee -a /etc/default/metrist-orchestrator
ENVIRONMENT_TAG=${bindings.environment}
METRIST_API_HOST=${bindings.environment == "dev1" ? "app-dev1" : "app"}.metrist.io
METRIST_API_TOKEN=$key
METRIST_RUN_GROUPS=jump-host
METRIST_INSTANCE_ID=priv-${bindings.environment}-${bindings.region}
${bindings.environment == "dev1" ? "METRIST_PREVIEW_MODE=true" : ""}
# Needed for ex_aws
HOME=/root
# Our standard vars, see ADR#0015
ENVIRONMENT_TAG=${bindings.environment}
AWS_REGION=${bindings.region}
AWS_BACKEND_REGION=${bindings.region}
ORCHESTRATOR_REGION=${bindings.region}
CLOUD_PLATFORM=aws
EOF
sudo systemctl enable --now metrist-orchestrator
sudo systemctl start metrist-orchestrator

##
## Configure and start Grafana.
##
mkdir -p /etc/grafana
cat <<EOF >>/etc/grafana/config.yaml
prometheus:
  wal_directory: /tmp/wal
  global:
    scrape_interval: 1m
    scrape_timeout: 10s
    evaluation_interval: 1m
    external_labels:
      environment: ${bindings.environment}
      subsystem: backend
      region: ${bindings.region}
      stage: ${bindings.stage}
  configs:
    - name: backend
      scrape_configs:
        - job_name: backend
          metrics_path: /internal/metrics
          dns_sd_configs:
            - names:
              - i-all.backend.${bindings.environment}.canarymonitor.net
              type: A
              port: ${bindings.applicationPort}
      remote_write:
        - url: https://prometheus-blocks-prod-us-central1.grafana.net/api/prom/push
          basic_auth:
            username: 170329
            password_file: /etc/grafana/prometheus_password
EOF
aws secretsmanager get-secret-value --secret-id /${bindings.environment}/grafana/credentials |
   jq -r '.SecretString' |
   jq -r '.GRAFANA_PROMETHEUS_API_KEY' >/etc/grafana/prometheus_password
chmod 400 /etc/grafana/prometheus_password

docker run -d \
  --restart unless-stopped \
  --name grafana-agent \
  -v /etc/grafana:/etc/grafana \
  grafana/agent:v0.21.2 \
  --config.file /etc/grafana/config.yaml

##
## Configure and start Tailscale.
##
echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.conf
echo 'net.ipv6.conf.all.forwarding = 1' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p /etc/sysctl.conf
ts_secret=$(aws secretsmanager get-secret-value --secret-id /${bindings.environment}/jumphost-tailscale-key|jq -r '.SecretString')
tailscale up \
  --authkey=$ts_secret \
  --advertise-routes=${bindings.rdsSubnet},${bindings.timescaleSubnet},192.168.0.2/32 \
  --hostname=${bindings.environment}-jumphost
`

export class Backend extends BaseModule {
  configs: Record<string, Config> = {
    'dev1': {
      instanceCount: 2,
      timescaleSubnet: '10.128.1.0/24',
      rdsSubnet: '172.31.0.0/16',
      rdsVpcId: 'vpc-919959ec',
      instanceType: 'c5.large',
      lambdaVpcConfig: {
        Cidr: '10.6.0.0/16',
        PrivateCidrs: ['10.6.1.0/24', '10.6.2.0/24'],
        PublicCidrs: ["10.6.3.0/24", "10.6.4.0/24"]
      }
    },
    'prod': {
      instanceCount: 2,
      timescaleSubnet: '10.128.2.0/24',
      rdsSubnet: '172.30.0.0/16',
      rdsVpcId: 'vpc-0d3c8c2c4ffc676b7',
      instanceType: 'c5.2xlarge',
      lambdaVpcConfig: {
        Cidr: '10.5.0.0/16',
        PrivateCidrs: ['10.5.1.0/24', '10.5.2.0/24'],
        PublicCidrs: ["10.5.3.0/24", "10.5.4.0/24"]
      }
    }
  }

  applicationPort = 4000

  config: Config
  vpc: Vpc
  lambdaVpc : StandardVpc
  tags: Record<string, string>

  constructor(context: Context)  {
    super(context)
    this.config = this.configs[context.environment] || this.configs['default']
    this.tags = standardTags(context.environment, 'backend')

    // VPC used for lambdas (private/public subnets, nat, igw)
    this.lambdaVpc = new StandardVpc(
      context,
      "lambda-vpc",
      this.config.lambdaVpcConfig.Cidr,
      this.config.lambdaVpcConfig.PrivateCidrs,
      this.config.lambdaVpcConfig.PublicCidrs
    )

    // TODO change this to a StandardVpc (note that we don't have a public subnet here, though)
    this.vpc = new Vpc(context.scope, this.makeName('vpc'), {
      cidrBlock: '192.168.0.0/16',
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: {
        ...this.tags,
        Name: this.makeName('vpc')
      },
      ...this.preventDestroy()
    })
    const igw = new InternetGateway(context.scope, this.makeName('igw'), {
      vpcId: Token.asString(this.vpc.id),
      tags: this.tags
    })
    const timescalePeering = new DataAwsVpcPeeringConnection(context.scope, this.makeName('tspeering'), {
        tags: {'terraform-id': `timescale-${context.environment}-peering`}
    })
    const rdsPeering = new VpcPeeringConnection(context.scope, this.makeName('rdspeering'), {
      peerVpcId: this.config.rdsVpcId,
      vpcId: this.vpc.id,
      autoAccept: true,
      accepter: {
        allowRemoteVpcDnsResolution: true
      },
      requester: {
        allowRemoteVpcDnsResolution: true
      }
    })
    new DefaultRouteTable(context.scope, this.makeName('rt'), {
      defaultRouteTableId: Token.asString(this.vpc.defaultRouteTableId),
      tags: {
        ...this.tags,
        Name: this.makeName('rt')
      },
      route: [
        {
          cidrBlock: '0.0.0.0/0',
          gatewayId: Token.asString(igw.id)
        },
        {
          ipv6CidrBlock: '::/0',
          gatewayId: Token.asString(igw.id)
        },
        {
          cidrBlock: this.config.timescaleSubnet,
          vpcPeeringConnectionId: Token.asString(timescalePeering.id)
        },
        {
          cidrBlock: this.config.rdsSubnet,
          vpcPeeringConnectionId: Token.asString(rdsPeering.id)
        }
      ],
      ...this.preventDestroy()
    })
    // Add a route back to us
    const rdsRouteTable = new DataAwsRouteTable(context.scope, this.makeName('rdsrtb'), {
        tags: {'terraform-id': `rds-${context.environment}-route-table`}
    })
    new Route(context.scope, this.makeName('rdsrouteback'), {
      routeTableId: rdsRouteTable.id,
      destinationCidrBlock: '192.168.0.0/16',
      vpcPeeringConnectionId: rdsPeering.id
    })
    let id = 0
    const subnets = azMapping[context.region].map(az =>
      new Subnet(context.scope, this.makeName(`sn${id}`), {
        vpcId: Token.asString(this.vpc.id),
        availabilityZone: az,
        cidrBlock: `192.168.${id++}.0/24`,
        tags: this.tags,
        ...this.preventDestroy()
      }))

    const ami = new DataAwsAmi(context.scope, 'elixir-runtime', {
      owners: ['self'],
      mostRecent: true,
      filter: [{
        name: 'tag:canary-runtime-type',
        values: ['elixir']
      }],
      tags: this.tags
    })

    const gwSg = this.makeGatewaySecurityGroup()
    const lbSg = this.makeLoadbalancerSecurityGroup()
    const instanceSg = this.makeInstanceSecurityGroup(lbSg, gwSg)
    this.enableClustering(gwSg, instanceSg)

    const jumpRole = new IamRole(context.scope, this.makeName('jrole'), {
      name: this.makeName('jrole'),
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'ec2.amazonaws.com'
          }
        }
      }),
      managedPolicyArns: [
        `arn:aws:iam::${accountId}:policy/S3SharedDistReader`,
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'
      ],
      inlinePolicy: [
        {
          name: this.makeName('ipolicy'),
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                // Allow jump host to read Grafana and Tailscale secrets
                Effect: 'Allow',
                Action: [
                  'secretsmanager:GetSecretValue'
                ],
                Resource: `arn:aws:secretsmanager:${context.region}:${accountId}:secret:/${context.environment}/*`
              }
            ]
          })
        }]
    })

    const jumpProfile = new IamInstanceProfile(context.scope, `${context.environment}-backend-jip`, {
      name: `${context.environment}-backend-jip`,
      role: jumpRole.name
    })

    const name = this.makeName('jump')
    const jump = new Instance(context.scope, `${name}-ec2`, {
      ami: ami.id,
      userDataReplaceOnChange: true,
      instanceType: 'c5.xlarge',
      userData: this.resolveUserData(jumpUserData, {
        rdsSubnet: '' + this.config.rdsSubnet,
        timescaleSubnet: '' + this.config.timescaleSubnet
      }),
      iamInstanceProfile: jumpProfile.name,
      tags: {
        ...this.tags,
        Name: name
      },
      associatePublicIpAddress: true,
      subnetId: Token.asString(subnets[0].id),
      vpcSecurityGroupIds: [Token.asString(gwSg.id)]
    })
    new Route53Record(context.scope, `${name}-rr`, {
      zoneId: context.tldZoneId,
      name: `jump.backend.${context.environment}`,
      type: 'CNAME',
      ttl: 300,
      records: [jump.publicDns]
    })

    const logs = new CloudwatchLogGroup(context.scope, this.makeName('log-group'), {
      name: this.makeName('logs'),
      tags: this.tags,
      retentionInDays: 90
    })

    // Define the ALB early so we can use it for the instance policy
    const alb = new Alb(context.scope, this.makeName('lb'), {
      name: this.makeName('lb'),
      internal: false,
      loadBalancerType: 'application',
      securityGroups: [Token.asString(lbSg.id)],
      subnets: subnets.map(sn => Token.asString(sn.id)),
      tags: this.tags,
      ...this.preventDestroy()
    })
    new Route53Record(context.scope, this.makeName('lb-rr'), {
      zoneId: context.tldZoneId,
      name: `lb.backend.${context.environment}`,
      type: 'CNAME',
      ttl: 300,
      records: [alb.dnsName]
    })
    const targetGroup = new AlbTargetGroup(context.scope, this.makeName('tgt'), {
      // Name must be unique, we want create before destroy, so every time we change something, bump this.
      // If you forget, Terraform will tell you :)
      name: this.makeName('tgt') + '-v2',
      port: this.applicationPort,
      protocol: 'HTTP',
      vpcId: Token.asString(this.vpc.id),
      healthCheck: {
        enabled: true,
        healthyThreshold: 2,
        unhealthyThreshold: 2,
        interval: 5,
        timeout: 4,
        matcher: "200-299",
        path: "/internal/health"
      },
      stickiness: {
        enabled: false,
        type: 'lb_cookie'
      },
      deregistrationDelay: "60",
      ...this.createBeforeDestroy
    })



    const instanceRole = new IamRole(context.scope, this.makeName('irole'), {
      name: this.makeName('irole'),
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'ec2.amazonaws.com'
          }
        }
      }),
      managedPolicyArns: [
        `arn:aws:iam::${accountId}:policy/S3SharedDistReader`,
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'
      ],
      inlinePolicy: [
        {
          name: this.makeName('ipolicy'),
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                // Allow logging
                Effect: 'Allow',
                Action: [
                  'logs:CreateLogStream',
                  'logs:DescribeLogStreams',
                  'logs:PutLogEvents'
                ],
                Resource: `${logs.arn}:*`
              },
              {
                // Allow Sup to fetch images from ECR
                Effect: 'Allow',
                Action: [
                  'ecr:GetAuthorizationToken',
                  'ecr:BatchCheckLayerAvailability',
                  'ecr:GetDownloadUrlForLayer',
                  'ecr:BatchGetImage'
                ],
                Resource: '*',
              },
              {
                // Allow Sup to find instances to cluster
                Effect: 'Allow',
                Action: [
                  'ec2:DescribeInstances'
                ],
                Resource: '*',
              },
              {
                // Allow Sup to fetch latest tags from S3
                Effect: 'Allow',
                Action: [
                  's3:GetObject'
                ],
                Resource: 'arn:aws:s3:::canary-private/version-stamps/*'
              },
              {
                // Allow Sup to linux packages from S3
                Effect: 'Allow',
                Action: [
                  's3:GetObject'
                ],
                Resource: 'arn:aws:s3:::canary-private/linux-packages/*'
              },
              { // Allow Sup to read SSM
                Effect: 'Allow',
                Action: [
                  'ssm:GetParameter'
                ],
                Resource: '*'
                // TODO Resource: `arn:aws:ssm:${context.region}:${accountId}:parameter/${context.environment}/*` or similar
              },
              { // Allow Sup to change target group membership
                Effect: 'Allow',
                Action: [
                  'elasticloadbalancing:RegisterTargets',
                  'elasticloadbalancing:DeregisterTargets'
                ],
                Resource: targetGroup.arn
              },
              { // Allow Sup to poll for target health
                Effect: 'Allow',
                Action: [
                  'elasticloadbalancing:DescribeTargetHealth',
                ],
                Resource: '*'
              },
              {
                // Allow backend to read secrets
                Effect: 'Allow',
                Action: [
                  'secretsmanager:GetSecretValue',
                  'secretsmanager:CreateSecret',
                  'secretsmanager:DescribeSecret',
                  'secretsmanager:TagResource'
                ],
                Resource: `arn:aws:secretsmanager:${context.region}:${accountId}:secret:/${context.environment}/*`
              },
              {
                // Allow backend to List secret. This is used for reading encryption keys
                Action: [
                    'secretsmanager:ListSecrets'
                ],
                Effect: "Allow",
                Resource: "*"
              },
              {
                // TODO what does this do?
                Effect: 'Allow',
                Action: [
                  // TODO tighten up
                  'ssmmessages:*'
                ],
                // TODO tighten up
                Resource: '*'
              },
              {
                Effect: 'Allow',
                Action: [
                  'ses:SendEmail'
                ],
                // TODO tighten up
                Resource: '*'
              },
              {
                // Allow backend to read our s3 private assets (such as datadog synthetic test payloads)
                Effect: "Allow",
                Action: [
                    's3:GetObject',
                    's3:ListBucket'
                ],
                Resource: [
                    'arn:aws:s3:::metrist-private-assets',
                    'arn:aws:s3:::metrist-private-assets/*'
                ]
              }
            ]
          })
        }]
    })

    const instanceProfile = new IamInstanceProfile(context.scope, `${context.environment}-backend-iip`, {
      name: `${context.environment}-backend-iip`,
      role: instanceRole.name
    })

    const resolvedUserData = this.resolveUserData(workerUserData, {
      targetGroupArn: targetGroup.arn,
      dockerRegistry: `${accountId}.dkr.ecr.${context.region}.amazonaws.com`,
      localMetricsBackendURL: context.environment == 'prod' ? 'https://metrics.metri.st' : 'https://staging.metrics.metri.st'
    })

    // Backend uses EC2 Tags https://hexdocs.pm/libcluster_ec2/ClusterEC2.html to form a cluster
    // To ensure that a new cluser name is assigned if the app instances are recreated, we need to add the attributes such as
    //  ami id and user data to the `keepers`
    const backendClusterId = new Uuid(context.scope, 'backend-app', {
      keepers: {
        ami_id: ami.id,
        resolvedUserData
      }})

    const instances = [...Array(this.config.instanceCount).keys()].map(i => {
      const name = this.makeName(`${i}`)
      // We rotate the instances through the subnets so we spread them out over AZs
      const sn = subnets[+i % subnets.length]

      const instance = new Instance(context.scope, `${name}-ec2`, {
        ami: ami.id,
        userDataReplaceOnChange: true,
        instanceType: this.config.instanceType,
        userData: resolvedUserData,
        iamInstanceProfile: instanceProfile.name,
        tags: {
          ...this.tags,
          Name: name,
          'cm-clustername': `backend-app-${backendClusterId.id}`
        },
        // Note: we do not really want this, but that requires also setting up private subnets, a NAT gateway, etc.
        // for now, this'll suffice. TODO: proper private/public split.
        associatePublicIpAddress: true,
        subnetId: Token.asString(sn.id),
        vpcSecurityGroupIds: [Token.asString(instanceSg.id)],
        ...this.createBeforeDestroy
      })
      // We need time for sup to start, pull docker, start the service
      // The 3 minutes is an emperically eyeballed value.
      const delay = new Sleep(context.scope, `${name}-sleep`, {
        dependsOn: [instance],
        createDuration: "3m",
        triggers: {
          instance_arn: instance.arn
        }
      })
      new Route53Record(context.scope, `${name}-rr`, {
        zoneId: context.tldZoneId,
        name: `i${i}.backend.${context.environment}`,
        type: 'CNAME',
        ttl: 300,
        records: [instance.privateDns]
      })
      new AlbTargetGroupAttachment(context.scope, this.makeName(`tgta${i++}`), {
        targetGroupArn: targetGroup.arn,
        targetId: Token.asString(instance.id),
        port: this.applicationPort,
        dependsOn: [
          { fqn: instance.fqn },
          delay
        ],
        ...this.createBeforeDestroy
      })
      return instance
    })
    new Route53Record(context.scope, this.makeName('rrall'), {
      zoneId: context.tldZoneId,
      name: `i-all.backend.${context.environment}`,
      type: 'A',
      ttl: 300,
      records: instances.map(i => i.privateIp),
    })
    if (context.environment.startsWith('dev-')) {
      this.setupListenersPlain(alb, targetGroup)
    } else {
      const lbCert = new AcmCertificate(context.scope, `${context.environment}-lb-cert`, {
        domainName: `app${context.environment == 'prod' ? '' : `-${context.environment}`}.metrist.io`,
        validationMethod: "DNS",
        lifecycle: {
          createBeforeDestroy: true
        }
      })
      this.setupListenersSsl(alb, targetGroup, lbCert.arn)
    }

    // Finally, stash the generated password in secrets manager
    const secret = new SecretsmanagerSecret(context.scope, this.makeName(`secret`), {
      name: `/${context.environment}/backend/serial-pass`
    })
    new SecretsmanagerSecretVersion(context.scope, this.makeName('secvsn'), {
      secretId: secret.id,
      secretString: userPass
    })

    this.setupCloudWatchSubscriptions()
  }

  private setupCloudWatchSubscriptions() {
    const subscriptionFilterPattern = {
      dotnet: [
        { name: 'exception', pattern: '?Exception ?ERROR' },
        { name: 'timed out',   pattern: 'Task timed out after'}
      ],
      elixir: [
        { name: 'error', pattern: '"[error]"' }
      ]
    }

    const defaultLambdaManagedPolicies = [
      'arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess',
      'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole',
      'arn:aws:iam::aws:policy/service-role/AWSLambdaENIManagementAccess',
      'arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess'
    ]

    const lambdaRole = new IamRole(
      this.context.scope, this.makeName(`error-handler-lambda-role`), {
        name: this.makeName(`error-handler-lambda-role`),
        assumeRolePolicy: JSON.stringify({
          Version: "2012-10-17",
          Statement:[
            {
              Action:"sts:AssumeRole",
              Effect:"Allow",
              Sid: "",
              Principal: {
                Service: "lambda.amazonaws.com"
              }
            }
          ]
        }),
        managedPolicyArns: defaultLambdaManagedPolicies,
        inlinePolicy: [
          {
            name: 'defaultAlertingLambdaPolicy',
            policy: JSON.stringify({
              Version: "2012-10-17",
              Statement: [
                {
                  Action: "secretsmanager:GetSecretValue",
                  Effect: "Allow",
                  Resource: `arn:aws:secretsmanager:${this.context.region}:${accountId}:secret:/${this.context.environment}/*`
                }
              ]
            })
          }
        ]
      }
    )

    const sg = new SecurityGroup(this.context.scope, this.makeName('error-handler-security-group'), {
      name: this.makeName('error-handler-security-group'),
      vpcId: Token.asString(this.lambdaVpc.vpc.id),
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
          ipv6CidrBlocks: ['::/0']
        }
      ]
    })

    const opsChannel = this.context.environment == "prod" ? "#ops" : "#ops-dev"

    const lambdaName = this.makeName('error-handler-lambda')
    const lambdaFunction = new LambdaFunction(
      this.context.scope, lambdaName, {
        functionName: lambdaName,
        runtime: 'nodejs18.x',
        memorySize: 256,
        timeout: 30,
        s3Bucket: `metrist-private-lambdas-${this.context.environment}`,
        s3Key: `error-handler-${this.context.environment}.zip`,
        handler: `main.lambdaHandler`,
        role: lambdaRole.arn,
        vpcConfig: {
          securityGroupIds: [sg.id],
          subnetIds: this.lambdaVpc.privateSubnets.map((subnet) => subnet.id)
        },
        environment: {
          variables: {
            "OPS_CHANNEL": opsChannel,
            "ENVIRONMENT_TAG": this.context.environment,
          }
        },
        // See (https://github.com/hashicorp/terraform-provider-aws/issues/10329) re: long wait times on destroy
        replaceSecurityGroupsOnDestroy: true
      }
    )

    new LambdaPermission(this.context.scope,  this.makeName('error-handler-cw-permission'), {
      statementId: "allowcloudwatch",
      action: "lambda:InvokeFunction",
      functionName: lambdaFunction.functionName,
      principal: "logs.amazonaws.com",
      sourceAccount: accountId.toString(),
      sourceArn: `arn:aws:logs:${this.context.region}:${accountId}:log-group:prod-orchestrator-logs:*`
    })

    new LambdaPermission(this.context.scope, this.makeName('error-handler-cw-region-permission'), {
      statementId: "allowCloudwatchRegion",
      action: "lambda:InvokeFunction",
      functionName: lambdaFunction.functionName,
      principal: `logs.${this.context.region}.amazonaws.com`,
      sourceAccount: accountId.toString(),
      sourceArn: `arn:aws:logs:${this.context.region}:${accountId}:log-group:*`
    })


    this.makeLogSubscriptionFilter('backend-logs',                        `${this.context.environment}-backend-logs`,                                  lambdaFunction.arn, subscriptionFilterPattern.elixir);
    this.makeLogSubscriptionFilter('orchestrator-logs',                   `${this.context.environment}-orchestrator-logs`,                             lambdaFunction.arn, subscriptionFilterPattern.elixir);
  }

  private setupListenersSsl(alb: Alb, targetGroup: AlbTargetGroup, certArn: string) {

    new AlbListener(this.context.scope, this.makeName('lbhttp'), {
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: 'HTTP',
      defaultAction: [{
        type: 'redirect',
        redirect: {
          protocol: 'HTTPS',
          port: '443',
          host: '#{host}',
          path: '/#{path}',
          query: '#{query}',
          statusCode: 'HTTP_301'
        }
      }],
      ...this.preventDestroy()
    })
    const listener = new AlbListener(this.context.scope, this.makeName('lbhttps'), {
      loadBalancerArn: alb.arn,
      port: 443,
      protocol: 'HTTPS',
      defaultAction: [{
        type: 'forward',
        targetGroupArn: targetGroup.arn
      }],
      certificateArn: certArn,
      sslPolicy: 'ELBSecurityPolicy-TLS-1-2-Ext-2018-06',
      ...this.preventDestroy()
    })


    // 1530: Keep using the old canary wildcard cert to avoid TLS errors when orchestrator calls the backend
    const cert = new DataAwsSsmParameter(this.context.scope, this.makeName('cert'), {
      name: `/${this.context.environment}/canaryWildcardCertArn`
    });

    new AlbListenerCertificate(this.context.scope, `${this.context.environment}-lb-cert-old`, {
      certificateArn: cert.value,
      listenerArn: listener.arn
    })

    this.setupListenerRules(listener)
  }

  private setupListenersPlain(alb: Alb, targetGroup: AlbTargetGroup) {
    // For development environments, we can do without HTTPS for now.
    const listener = new AlbListener(this.context.scope, this.makeName('lbhttp'), {
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: 'HTTP',
      defaultAction: [{
        type: 'forward',
        forward: {
          targetGroup: [{
            arn: targetGroup.arn
          }]
        }
      }],
      ...this.preventDestroy()
    })

    this.setupListenerRules(listener)
  }

  private setupListenerRules(listener: AlbListener) {
    new AlbListenerRule(this.context.scope, this.makeName('lblr-0'), {
      listenerArn: listener.arn,
      priority: 100,
      condition: [{
        pathPattern: {
          values: ['/internal/*']
        }
      }],
      action: [{
        type: 'fixed-response',
        fixedResponse: {
          contentType: 'text/plain',
          messageBody: 'Forbidden',
          statusCode: '403'
        }
      }]
    })
    new AlbListenerRule(this.context.scope, this.makeName('lblr-1'), {
      listenerArn: listener.arn,
      priority: 101,
      condition: [{
        hostHeader: {
          values: [this.makeHostName('canarymonitor.com')]
        }
      }],
      action: [{
        type: 'redirect',
        redirect: {
          protocol: 'HTTPS',
          port: '443',
          statusCode: 'HTTP_301',
          host: this.makeHostName('metrist.io')
        }
      }]
    })
  }

  private makeLoadbalancerSecurityGroup() {
    return new SecurityGroup(this.context.scope, this.makeName('lb-sg'), {
      name: this.makeName('lb-sg'),
      vpcId: Token.asString(this.vpc.id),
      tags: this.tags,
      ingress: [
        {
          fromPort: 443,
          toPort: 443,
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
          ipv6CidrBlocks: ['::/0']
        },
        {
          fromPort: 80,
          toPort: 80,
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
          ipv6CidrBlocks: ['::/0']
        }
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
          ipv6CidrBlocks: ['::/0']
        }
      ]
    })
  }

  private makeGatewaySecurityGroup() {
    const sg = new SecurityGroup(this.context.scope, this.makeName('gwsg'), {
      name: this.makeName('gwsg'),
      vpcId: Token.asString(this.vpc.id),
      tags: this.tags
    })
    new SecurityGroupRule(this.context.scope, this.makeName('gwsgr2'), {
      securityGroupId: Token.asString(sg.id),
      type: 'egress',
      fromPort: 0,
      toPort: 0,
      protocol: '-1',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0']
    })
    return sg
  }

  private makeInstanceSecurityGroup(lbSg: SecurityGroup, gwSg: SecurityGroup) {
    const sg = new SecurityGroup(this.context.scope, this.makeName('isg'), {
      name: this.makeName('isg'),
      vpcId: Token.asString(this.vpc.id),
      tags: this.tags
    })

    // For now, we allow full connectivity between nodes in the cluster. Security-wise,
    // pinning it down won't help a lot anyway.
    new SecurityGroupRule(this.context.scope, this.makeName('isgr1-v2'), {
      securityGroupId: Token.asString(sg.id),
      type: 'ingress',
      fromPort: 0,
      toPort: 65535,
      protocol: '-1',
      sourceSecurityGroupId: Token.asString(sg.id)
    })

    // Allow access from the load balancer
    new SecurityGroupRule(this.context.scope, this.makeName('isgr2'), {
      securityGroupId: Token.asString(sg.id),
      type: 'ingress',
      fromPort: this.applicationPort,
      toPort: this.applicationPort,
      protocol: 'tcp',
      sourceSecurityGroupId: Token.asString(lbSg.id)
    })

    // Allow SSH access from gateway
    new SecurityGroupRule(this.context.scope, this.makeName('isgr3'), {
      securityGroupId: Token.asString(sg.id),
      type: 'ingress',
      fromPort: 22,
      toPort: 22,
      protocol: 'tcp',
      sourceSecurityGroupId: Token.asString(gwSg.id)
    })

    // Terraform always requires explicit egress
    // TODO refactor, there's code duplication above
    new SecurityGroupRule(this.context.scope, this.makeName('isgr4'), {
      securityGroupId: Token.asString(sg.id),
      type: 'egress',
      fromPort: 0,
      toPort: 0,
      protocol: '-1',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0']
    })

    // Allow application access from gateway. Mostly for metrics scraping
    // by the Grafana Agent (Prometheus).
    new SecurityGroupRule(this.context.scope, this.makeName('isgr5'), {
      securityGroupId: Token.asString(sg.id),
      type: 'ingress',
      fromPort: this.applicationPort,
      toPort: this.applicationPort,
      protocol: 'tcp',
      sourceSecurityGroupId: Token.asString(gwSg.id)
    })

    return sg
  }

  // Allow jump host to setup erlang clustering with the other nodes. This
  // allows us to run things like Observer from the jump host which has "better"
  // (read "more permissive") connectivity to the outside. Port range is set
  // in backend's vm.args.eex template.
  private enableClustering(gwSg: SecurityGroup, instanceSg: SecurityGroup) {
    const epmdPort = 4369 // from /etc/services
    new SecurityGroupRule(this.context.scope, this.makeName('csgr1'), {
      securityGroupId: Token.asString(gwSg.id),
      type: 'ingress',
      fromPort: epmdPort,
      toPort: epmdPort,
      protocol: 'tcp',
      sourceSecurityGroupId: Token.asString(instanceSg.id)
    })
    new SecurityGroupRule(this.context.scope, this.makeName('csgr2'), {
      securityGroupId: Token.asString(gwSg.id),
      type: 'ingress',
      fromPort: 9000,
      toPort: 9010,
      protocol: 'tcp',
      sourceSecurityGroupId: Token.asString(instanceSg.id)
    })
    new SecurityGroupRule(this.context.scope, this.makeName('csgr3'), {
      securityGroupId: Token.asString(instanceSg.id),
      type: 'ingress',
      fromPort: 9000,
      toPort: 9010,
      protocol: 'tcp',
      sourceSecurityGroupId: Token.asString(gwSg.id)
    })
    new SecurityGroupRule(this.context.scope, this.makeName('csgr4'), {
      securityGroupId: Token.asString(instanceSg.id),
      type: 'ingress',
      fromPort: epmdPort,
      toPort: epmdPort,
      protocol: 'tcp',
      sourceSecurityGroupId: Token.asString(gwSg.id)
    })
  }

  private resolveUserData(userData: (bindings: Record<string, string>) => string, extraBindings: Record<string, string> = {}) {
    return userData({
      ...extraBindings,
      environment: this.context.environment,
      region: this.context.region,
      stage: this.context.stage,
      applicationPort: '' + this.applicationPort
    })
  }

  private makeLogSubscriptionFilter(name: string, logGroupName: string, destinationArn: string, filterPatterns: {name: string, pattern: string}[]) {
    for (const {name: patternName, pattern} of filterPatterns) {
      const resourceName = `${name}-subfilter-${patternName}`;
      new CloudwatchLogSubscriptionFilter(this.context.scope, resourceName, {
        name: patternName,
        filterPattern: pattern,
        destinationArn,
        logGroupName
      })
    }
  }
}
