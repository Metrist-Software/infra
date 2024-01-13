import { ParamConfig } from ".";

export const prodMonUSWest1: ParamConfig = {
  "analyzers-enabled-ssm-param": {
    type: "String",
    value: 'false',
    name: "analyzersEnabled"
  },
  "database-ssm-param": {
    type: "String",
    value: '{"logicalName":"prod","suffix":" "}',
    name: "database"
  },
  "email-ssm-param": {
    type: "String",
    value: '{"defaultFromEmail":"support@metrist.io","newPrivateMonitorAlertEmails":"eng@metrist.io prod@metrist.io"}',
    name: "email"
  },
  "internal-ssm-param": {
    type: "String",
    value: '{"opsChannel":"#ops"}',
    name: "internal"
  },
  "is-production-ssm-param": {
    type: "String",
    value: 'true',
    name: "isProduction"
  },
  "monitors-ssm-param": {
    type: "String",
    value: '{"ec2":{"amiId":"ami-055a0e87092ed2ba4","persistentInstanceId":"i-0a2730a0afc352343"},"enableCleanup":"false","pagerduty":{"serviceId":"P0022EJ"}}',
    name: "monitors"
  },
  "stacks-ssm-param": {
    type: "String",
    value: '{"alertingStackName":"alerting-stack","emailAlertingStackName":"email-alerting","enableStatusPageObservers":"false","enableTimers":"true","errorLogHandlerStackName":"error-logs","errorLogPattern":"Exception","githubStackName":"monitor-github","herokuStackName":"monitor-heroku","kmsStackName":"kms-stack","monitorsOnly":"true","networkStackName":"network-stack","pagerDutySMSStackName":"monitor-pdsms","pagerDutyStackName":"monitor-pagerduty","pagerdutyAlertingStackName":"pagerduty-alerting","rolesStackName":"roles-stack","sentryStackName":"monitor-sentry","slackAlertingStackName":"slack-alerting","teamsAlertingStackName":"teams-alerting","webhooksAlertingStackName":"webhooks-alerting"}',
    name: "stacks"
  },
  "webapp-hostname-ssm-param": {
    type: "String",
    value: 'app.metrist.io',
    name: "webappHostname"
  },
  "webapp-root-ssm-param": {
    type: "String",
    value: 'https://app.metrist.io',
    name: "webappRoot"
  },
  "api-endpoints-ssm-param": {
    type: "String",
    value: '{"appAPI":"app.metrist.io","backendAPI":"app.metrist.io","teamsAPI":"teamsapi.canarymonitor.com","telemetryAPI":"app.metrist.io"}',
    name: "apiEndpoints"
  },
  "api-endpoints-app-api-ssm-param": {
    type: "String",
    value: 'app.metrist.io',
    name: "apiEndpoints/appAPI"
  },
  "api-endpoints-backend-api-ssm-param": {
    type: "String",
    value: 'app.metrist.io',
    name: "apiEndpoints/backendAPI"
  },
  "api-endpoints-teams-api-ssm-param": {
    type: "String",
    value: 'teamsapi.canarymonitor.com',
    name: "apiEndpoints/teamsAPI"
  },
  "api-endpoints-telemetry-api-ssm-param": {
    type: "String",
    value: 'app.metrist.io',
    name: "apiEndpoints/telemetryAPI"
  },
  "database-logical-name-ssm-param": {
    type: "String",
    value: 'prod',
    name: "database/logicalName"
  },
  "database-suffix-ssm-param": {
    type: "String",
    value: ' ',
    name: "database/suffix"
  },
  "email-default-from-email-ssm-param": {
    type: "String",
    value: 'support@metrist.io',
    name: "email/defaultFromEmail"
  },
  "email-new-private-monitor-alert-emails-ssm-param": {
    type: "String",
    value: 'eng@metrist.io prod@metrist.io',
    name: "email/newPrivateMonitorAlertEmails"
  },
  "internal-ops-channel-ssm-param": {
    type: "String",
    value: '#ops',
    name: "internal/opsChannel"
  },
  "monitors-ec2-ssm-param": {
    type: "String",
    value: '{"amiId":"ami-055a0e87092ed2ba4","persistentInstanceId":"i-0a2730a0afc352343"}',
    name: "monitors/ec2"
  },
  "monitors-ec2-persistent-instance-id-ssm-param": {
    type: "String",
    value: 'i-0a2730a0afc352343',
    name: "monitors/ec2/persistentInstanceId"
  },
  "monitors-enable-cleanup-ssm-param": {
    type: "String",
    value: 'false',
    name: "monitors/enableCleanup"
  },
  "monitors-pagerduty-ssm-param": {
    type: "String",
    value: '{"serviceId":"P0022EJ"}',
    name: "monitors/pagerduty"
  },
  "monitors-ec2-ami-id-ssm-param": {
    type: "String",
    value: 'ami-055a0e87092ed2ba4',
    name: "monitors/ec2/amiId"
  },
  "monitors-pagerduty-service-id-ssm-param": {
    type: "String",
    value: 'P0022EJ',
    name: "monitors/pagerduty/serviceId"
  },
  "stacks-enable-timers-ssm-param": {
    type: "String",
    value: 'true',
    name: "stacks/enableTimers"
  },
  "stacks-network-stack-name-ssm-param": {
    type: "String",
    value: 'network-stack',
    name: "stacks/networkStackName"
  },
  "stacks-pager-duty-stack-name-ssm-param": {
    type: "String",
    value: 'monitor-pagerduty',
    name: "stacks/pagerDutyStackName"
  },
  "stacks-pagerduty-alerting-stack-name-ssm-param": {
    type: "String",
    value: 'pagerduty-alerting',
    name: "stacks/pagerdutyAlertingStackName"
  },
  "stacks-roles-stack-name-ssm-param": {
    type: "String",
    value: 'roles-stack',
    name: "stacks/rolesStackName"
  },
  "stacks-sentry-stack-name-ssm-param": {
    type: "String",
    value: 'monitor-sentry',
    name: "stacks/sentryStackName"
  },
  "stacks-alerting-stack-name-ssm-param": {
    type: "String",
    value: 'alerting-stack',
    name: "stacks/alertingStackName"
  },
  "stacks-email-alerting-stack-name-ssm-param": {
    type: "String",
    value: 'email-alerting',
    name: "stacks/emailAlertingStackName"
  },
  "stacks-enable-status-page-observers-ssm-param": {
    type: "String",
    value: 'false',
    name: "stacks/enableStatusPageObservers"
  },
  "stacks-error-log-handler-stack-name-ssm-param": {
    type: "String",
    value: 'error-logs',
    name: "stacks/errorLogHandlerStackName"
  },
  "stacks-error-log-pattern-ssm-param": {
    type: "String",
    value: 'Exception',
    name: "stacks/errorLogPattern"
  },
  "stacks-heroku-stack-name-ssm-param": {
    type: "String",
    value: 'monitor-heroku',
    name: "stacks/herokuStackName"
  },
  "stacks-kms-stack-name-ssm-param": {
    type: "String",
    value: 'kms-stack',
    name: "stacks/kmsStackName"
  },
  "stacks-slack-alerting-stack-name-ssm-param": {
    type: "String",
    value: 'slack-alerting',
    name: "stacks/slackAlertingStackName"
  },
  "stacks-teams-alerting-stack-name-ssm-param": {
    type: "String",
    value: 'teams-alerting',
    name: "stacks/teamsAlertingStackName"
  },
  "stacks-webhooks-alerting-stack-name-ssm-param": {
    type: "String",
    value: 'webhooks-alerting',
    name: "stacks/webhooksAlertingStackName"
  },
  "stacks-github-stack-name-ssm-param": {
    type: "String",
    value: 'monitor-github',
    name: "stacks/githubStackName"
  },
  "stacks-monitors-only-ssm-param": {
    type: "String",
    value: 'true',
    name: "stacks/monitorsOnly"
  },
  "stacks-pager-duty-sms-stack-name-ssm-param": {
    type: "String",
    value: 'monitor-pdsms',
    name: "stacks/pagerDutySMSStackName"
  }
}
