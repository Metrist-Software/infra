//
// Various common stuff, mostly configuration data.

// We want at least two AZs per region, but more is fine.
export const azMapping: Record<string, Array<string>> = {
  'us-west-1': ['us-west-1a', 'us-west-1b'],
  'us-east-1': ['us-east-1a', 'us-east-1b'],
  'us-west-2': ['us-west-2a', 'us-west-2b'],
  'us-east-2': ['us-east-2a', 'us-east-2b'],
  'ca-central-1': ['ca-central-1a', 'ca-central-1b']
}

export const standardTags = function(environment: string, subsystem: string) : Record<string, string> {
  return {
    'cm-env': environment,
    'cm-subsystem': subsystem,
    'cm-env-subsystem': `${environment}-metrist-${subsystem}`
  }
}

export const accountId = 123456789

// TODO probably import all the parameter store settings here so they can be version controlled
