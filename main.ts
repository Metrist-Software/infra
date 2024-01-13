import { Construct } from 'constructs'
import { App, TerraformStack, S3Backend } from 'cdktf'
import { AwsProvider } from './.gen/providers/aws/provider'
import { RandomProvider } from './.gen/providers/random/provider'
import { TimeProvider } from './.gen/providers/time/provider'
import { Backend } from './src/backend'
import { ParameterStore } from './src/parameterStore'

export interface Context {
  scope: Construct,
  environment: string,
  region: string,
  tldZoneId: string,
  stage: string
}

interface Config {
  env: string,
  region: string,
  stage: string
}

interface EnvTagFeature {
  backend?: boolean;
  parameterStore?: boolean;
}

class CanaryInfra extends TerraformStack {
  configs: Record<string, Config> = {
    'dev1': {
      env: 'dev1',
      region: 'us-east-1',
      stage: 'development'
    },
    'prod-mon-us-east-1': {
      env: 'prod-mon-us-east-1',
      region: 'us-east-1',
      stage: 'production'
    },
    'prod-mon-us-west-1': {
      env: 'prod-mon-us-west-1',
      region: 'us-west-1',
      stage: 'production'
    },
    'prod': {
      env: 'prod',
      region: 'us-west-2',
      stage: 'production'
    },
    'prod2': {
      env: 'prod2',
      region: 'us-east-2',
      stage: 'production'
    },
    'default': {
      env: `dev-${process.env.USER}`,
      region: 'ca-central-1',
      stage: 'local'
    }
  }

  features: Record<string, EnvTagFeature> = {
    'dev1': {
      backend: true,
      parameterStore: true,
    },
    'prod-mon-us-east-1': {
      parameterStore: true,
    },
    'prod-mon-us-west-1': {
      parameterStore: true,
    },
    'prod': {
      backend: true,
      parameterStore: true,
    },
    'prod2': {
      parameterStore: true,
    },
    'default': {
      backend: true,
    }
  }

  constructor(scope: Construct, tag: string) {
    super(scope, `infra-${tag}`)

    const config = this.configs[tag] || this.configs['default']
    const features = this.features[tag] || this.features['default']

    new S3Backend(this, {
      bucket: 'cmtf-infra',
      key: `terraform/${config.env}/statefile`,
      dynamodbTable: 'cmtf-infra',
      region: 'us-west-2'
    })

    new AwsProvider(this, 'aws', {
      region: config.region
    })

    new RandomProvider(this, 'random', {})
    new TimeProvider(this, 'time', {})

    const context: Context = {
      scope: this,
      environment: config.env,
      region: config.region,
      tldZoneId: 'Z0005462EW6V8K2SUMK3',
      stage: config.stage
    }

    if (features.backend) {
      new Backend(context)
    }

    if (features.parameterStore) {
      new ParameterStore(context)
    }
  }
}

const tag = process.env.ENVIRONMENT_TAG ?? `dev-${process.env.USER}`
const app = new App()
new CanaryInfra(app, tag)
app.synth()
