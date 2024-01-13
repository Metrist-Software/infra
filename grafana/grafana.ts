//
// Terraform to setup grafana in a specified region. Sets it up behind an ELB (for simpler SSL provisioning and instance changes)
//
//


import { Context } from './main'
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
import { randomBytes } from 'crypto'

interface Config {
  instanceType: string
}

export const standardTags = function() : Record<string, string> {
  return {
    'metrist-subsystem': 'grafana'
  }
}

export const azMapping: Record<string, Array<string>> = {
  'us-west-1': ['us-west-1a', 'us-west-1b'],
  'us-east-1': ['us-east-1a', 'us-east-1b'],
  'us-west-2': ['us-west-2a', 'us-west-2b'],
  'us-east-2': ['us-east-2a', 'us-east-2b'],
  'ca-central-1': ['ca-central-1a', 'ca-central-1b']
}

const userPass = randomBytes(32).toString('hex')
const adminPass = randomBytes(32).toString('hex')

const userData = (bindings: Record<string, string>) => `#!/bin/sh -vx

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

# Install needed packages
sudo apt-get update
sudo apt-get install -y apt-transport-https software-properties-common wget jq awscli unzip

# Retrieve needed secrets
grafana_secrets=$(aws secretsmanager get-secret-value --region ${bindings.region} --secret-id /prod/grafana/secrets | jq -r '.SecretString')

##
## Configure Grafana
##

sudo wget -q -O /usr/share/keyrings/grafana.key https://apt.grafana.com/gpg.key

echo "deb [signed-by=/usr/share/keyrings/grafana.key] https://apt.grafana.com stable main" | sudo tee -a /etc/apt/sources.list.d/grafana.list

sudo apt-get update
sudo apt-get install -y grafana-enterprise crudini

sudo systemctl daemon-reload
sudo systemctl start grafana-server
sudo systemctl status grafana-server
sudo systemctl stop grafana-server

sudo systemctl enable grafana-server.service

# We're using crudini (https://github.com/pixelb/crudini) to update or add section/values as some values will already be there
sudo crudini --set /etc/grafana/grafana.ini server root_url ${bindings.grafanaUrl}
sudo crudini --set /etc/grafana/grafana.ini plugins allow_loading_unsigned_plugins metrist-datasource
sudo crudini --set /etc/grafana/grafana.ini paths plugins /var/lib/grafana/plugins

# Add google auth stuff
google_client_id=$(echo -n $grafana_secrets | jq -r '."google_client_id"')
google_client_secret=$(echo -n $grafana_secrets | jq -r '."google_client_secret"')

sudo crudini --set /etc/grafana/grafana.ini auth oauth_auto_login true
sudo crudini --set /etc/grafana/grafana.ini security cookie_secure true
sudo crudini --set /etc/grafana/grafana.ini security admin_password ${bindings.adminPass}

# We are going to auto assign admin since allow_sign_up defaults to false. When a new Google OAuth user is able to authenticate they will get admin in our dogfood grafana
sudo crudini --set /etc/grafana/grafana.ini users auto_assign_org_role Admin

sudo crudini --set /etc/grafana/grafana.ini auth.google enabled true
sudo crudini --set /etc/grafana/grafana.ini auth.google client_id $google_client_id
sudo crudini --set /etc/grafana/grafana.ini auth.google client_secret $google_client_secret
sudo crudini --set /etc/grafana/grafana.ini auth.google scopes "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email"
sudo crudini --set /etc/grafana/grafana.ini auth.google auth_url https://accounts.google.com/o/oauth2/auth
sudo crudini --set /etc/grafana/grafana.ini auth.google token_url https://accounts.google.com/o/oauth2/token
sudo crudini --set /etc/grafana/grafana.ini auth.google allowed_domains metrist.io
sudo crudini --set /etc/grafana/grafana.ini auth.google allow_sign_up true
sudo crudini --set /etc/grafana/grafana.ini auth.google hosted_domain metrist.io

mkdir -p /var/lib/grafana/plugins

# This URL will always point to the latest release from our repo
wget -nv -O /tmp/metrist-datasource.zip https://github.com/Metrist-Software/metrist-grafana-datasource/releases/latest/download/metrist-datasource.zip
unzip /tmp/metrist-datasource.zip -d /var/lib/grafana/plugins

chown -R grafana:grafana /var/lib/grafana/plugins

sudo systemctl start grafana-server
sudo systemctl status grafana-server


echo ubuntu:${userPass} | chpasswd

##
## Configure and start Tailscale.
##
# Add Tailscale APT repos
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list

sudo apt-get update
sudo apt-get install -y tailscale


ts_secret=$(echo -n $grafana_secrets | jq -r '."tailscale_secret"')

tailscale up \
  --authkey=$ts_secret \
  --hostname=grafana-${bindings.region}
`


export class Grafana {
  applicationPort = 3000

  config: Config
  vpc: Vpc
  tags: Record<string, string>
  context: Context


  constructor(context: Context)  {
    this.context = context
    this.config = {
      instanceType: 'c5.large'
    }
    this.tags = standardTags()

    this.vpc = new Vpc(context.scope, this.makeName('vpc'), {
      cidrBlock: '192.168.0.0/16',
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: {
        ...this.tags,
        Name: this.makeName('vpc')
      }
    })
    const igw = new InternetGateway(context.scope, this.makeName('igw'), {
      vpcId: Token.asString(this.vpc.id),
      tags: this.tags
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
      ],
    })
    const ami = new DataAwsAmi(context.scope, 'ubuntu-2204', {
      owners: ['099720109477'],
      mostRecent: true,
      filter: [{
        name: 'name',
        values: ['ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server*']
      }],
      tags: this.tags
    })

    const lbSg = this.makeLoadbalancerSecurityGroup()
    const iSg = this.makeInstanceSecurityGroup(lbSg)

    const role = new IamRole(context.scope, this.makeName('role'), {
      name: this.makeName('role'),
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
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'
      ],
      inlinePolicy: [
        {
          name: this.makeName('ipolicy'),
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'secretsmanager:GetSecretValue'
                ],
                Resource: `arn:aws:secretsmanager:${context.region}:${context.accountId}:secret:/prod/grafana/*`
              }
            ]
          })
        }]
    })

    const profile = new IamInstanceProfile(context.scope, `grafana-ip`, {
      name: `grafana-ip`,
      role: role.name
    })

    const subnet = new Subnet(context.scope, this.makeName(`sn-1`), {
        vpcId: Token.asString(this.vpc.id),
        availabilityZone: azMapping[context.region][0],
        cidrBlock: `192.168.1.0/24`,
        tags: this.tags
      })

    const subnet1 = new Subnet(context.scope, this.makeName(`sn-2`), {
      vpcId: Token.asString(this.vpc.id),
      availabilityZone: azMapping[context.region][1],
      cidrBlock: `192.168.2.0/24`,
      tags: this.tags
    })

    const name = this.makeName(context.region)
    const instance = new Instance(context.scope, `${name}-ec2`, {
      ami: ami.id,
      userDataReplaceOnChange: true,
      instanceType: this.config.instanceType,
      userData: userData({
        grafanaUrl: `https://${this.context.subDomain}.metrist.io`,
        region: this.context.region,
        adminPass: adminPass
      }),
      iamInstanceProfile: profile.name,
      tags: {
        ...this.tags,
        Name: name
      },
      associatePublicIpAddress: true,
      subnetId: Token.asString(subnet.id),
      vpcSecurityGroupIds: [Token.asString(iSg.id)]
    })

    // Define the ALB early so we can use it for the instance policy
    const alb = new Alb(context.scope, this.makeName('lb'), {
      name: this.makeName('lb'),
      internal: false,
      loadBalancerType: 'application',
      securityGroups: [Token.asString(lbSg.id)],
      subnets: [Token.asString(subnet.id), Token.asString(subnet1.id)],
      tags: this.tags
    })

    const targetGroup = new AlbTargetGroup(context.scope, this.makeName('tgt'), {
      name: this.makeName('tgt'),
      port: this.applicationPort,
      protocol: 'HTTP',
      vpcId: Token.asString(this.vpc.id),
      stickiness: {
        enabled: false,
        type: 'lb_cookie'
      }
    })

    const lbCert = new AcmCertificate(context.scope, `grafana-lb-cert`, {
      domainName: `${this.context.subDomain}.metrist.io`,
      validationMethod: "DNS",
      lifecycle: {
        createBeforeDestroy: true
      }
    })
    this.setupListeners(alb, targetGroup, lbCert.arn)

    new AlbTargetGroupAttachment(context.scope, this.makeName(`tgta-1`), {
      targetGroupArn: targetGroup.arn,
      targetId: Token.asString(instance.id),
      port: this.applicationPort,
      dependsOn: [
        { fqn: instance.fqn }
      ]
    })

    // Finally, stash the generated password in secrets manager
    this.writeSecret(context, `serial`, `/prod/grafana/serial-pass`, userPass)
    // Also store the generated admin password
    this.writeSecret(context, `admin`, `/prod/grafana/admin-pass`, adminPass)
  }

  private writeSecret(context: Context, tag: string, secretName: string, secretValue: string) {
    // Also store the generated admin password
    const secret = new SecretsmanagerSecret(context.scope, this.makeName(`${tag}-secret`), {
      name: secretName
    })
    new SecretsmanagerSecretVersion(context.scope, this.makeName(`${tag}-secvsn`), {
      secretId: secret.id,
      secretString: secretValue
    })
  }

  private setupListeners(alb: Alb, targetGroup: AlbTargetGroup, certArn: string) {

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
      }]
    })
    new AlbListener(this.context.scope, this.makeName('lbhttps'), {
      loadBalancerArn: alb.arn,
      port: 443,
      protocol: 'HTTPS',
      defaultAction: [{
        type: 'forward',
        targetGroupArn: targetGroup.arn
      }],
      certificateArn: certArn,
      sslPolicy: 'ELBSecurityPolicy-TLS-1-2-Ext-2018-06'
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

  private makeInstanceSecurityGroup(lbSg: SecurityGroup) {
    const sg = new SecurityGroup(this.context.scope, this.makeName('isg'), {
      name: this.makeName('isg'),
      vpcId: Token.asString(this.vpc.id),
      tags: this.tags
    })
    new SecurityGroupRule(this.context.scope, this.makeName('isg-egress'), {
      securityGroupId: Token.asString(sg.id),
      type: 'egress',
      fromPort: 0,
      toPort: 0,
      protocol: '-1',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0']
    })

    // Allow access from the load balancer
    new SecurityGroupRule(this.context.scope, this.makeName('isg-ingress'), {
      securityGroupId: Token.asString(sg.id),
      type: 'ingress',
      fromPort: this.applicationPort,
      toPort: this.applicationPort,
      protocol: 'tcp',
      sourceSecurityGroupId: Token.asString(lbSg.id)
    })

    return sg
  }

  private makeName(part: string) : string {
    return `grafana-${part}`
  }
}
