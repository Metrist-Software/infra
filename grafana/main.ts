//
// Terraform to setup grafana in a specified region. Sets it up behind an ELB (for simpler SSL provisioning and instance changes)
// This does not configure DNS but does setup the cert for on the ELB
//

import { Construct } from 'constructs'
import { App, TerraformStack, S3Backend } from 'cdktf'
import { AwsProvider } from '../.gen/providers/aws/provider'
import { RandomProvider } from '../.gen/providers/random/provider'
import { TimeProvider } from '../.gen/providers/time/provider'
import { Grafana } from './grafana'

export interface Context {
  scope: Construct,
  region: string,
  accountId: string,
  subDomain: string
}

class MetristGrafana extends TerraformStack {
  constructor(scope: Construct, region: string, accountId: string, subDomain: string, stateLocation: string) {
    super(scope, `grafana-${region}`)

    new S3Backend(this, {
      bucket: stateLocation,
      key: `terraform/grafana-${region}/statefile`,
      dynamodbTable: stateLocation,
      region: 'us-west-2'
    })

    new AwsProvider(this, 'aws', {
      region: region
    })

    new RandomProvider(this, 'random', {})
    new TimeProvider(this, 'time', {})


    const context: Context = {
      scope: this,
      region: region,
      accountId: accountId,
      subDomain: subDomain
    }

    new Grafana(context)
  }
}

const subDomain = process.env.GRAFANA_INSTALL_SUBDOMAIN ?? "grafana"
const tag = process.env.GRAFANA_INSTALL_REGION ?? "us-east-1"
const accountId = process.env.GRAFANA_INSTALL_AWS_ACCOUNT_ID ?? "123456789"
const stateFileLocation = process.env.GRAFANA_INSTALL_OVERRIDE_STATE_LOCATION ?? "cdktf-grafana-infra"
const app = new App()
new MetristGrafana(app, tag, accountId, subDomain, stateFileLocation)
app.synth()
