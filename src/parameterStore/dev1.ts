import { ParamConfig } from ".";

export const dev1: ParamConfig = {
  "analyzers-enabled-ssm-param": {
    type: "String",
    value: 'true',
    name: "analyzersEnabled"
  },
  "api-endpoints-ssm-param": {
    type: "String",
    value: '{"appAPI":"app-dev1.metrist.io","backendAPI":"app-dev1.metrist.io","teamsAPI":"teamsapi-dev.canarymonitor.com","telemetryAPI":"app-dev1.metrist.io"}',
    name: "apiEndpoints"
  },
  "database-ssm-param": {
    type: "String",
    value: '{"logicalName":"dev"}',
    name: "database"
  },
  "email-ssm-param": {
    type: "String",
    value: '{"defaultFromEmail":"support@metrist.io","newPrivateMonitorAlertEmails":" "}',
    name: "email"
  },
  "internal-ssm-param": {
    type: "String",
    value: '{"opsChannel":"#ops-dev"}',
    name: "internal"
  },
  "is-production-ssm-param": {
    type: "String",
    value: 'false',
    name: "isProduction"
  },
  "monitors-ssm-param": {
    type: "String",
    value: '{"ec2":{"amiId":"ami-0739f8cdb239fe9ae","persistentInstanceId":"i-0a9cd6386ce4162d2"},"enableCleanup":"false","pagerduty":{"serviceId":"PS7AR2J"}}',
    name: "monitors"
  },
  "stacks-ssm-param": {
    type: "String",
    value: '{"alertingStackName":"alerting-stack","datadogAlertingStackName":"datadog-alerting","emailAlertingStackName":"email-alerting","enableStatusPageObservers":"true","enableTimers":"true","errorLogHandlerStackName":"error-logs","errorLogPattern":"Exception","githubStackName":"monitor-github","herokuStackName":"monitor-heroku","kmsStackName":"kms-stack","monitorsOnly":"false","networkStackName":"network-stack","pagerDutySMSStackName":"monitor-pdsms","pagerDutyStackName":"monitor-pagerduty","pagerdutyAlertingStackName":"pagerduty-alerting","rolesStackName":"roles-stack","sentryStackName":"monitor-sentry","slackAlertingStackName":"slack-alerting","teamsAlertingStackName":"teams-alerting","webhooksAlertingStackName":"webhooks-alerting"}',
    name: "stacks"
  },
  "webapp-hostname-ssm-param": {
    type: "String",
    value: 'app-dev1.metrist.io',
    name: "webappHostname"
  },
  "webapp-root-ssm-param": {
    type: "String",
    value: 'http://localhost:3000',
    name: "webappRoot"
  },
  "api-endpoints-app-api-ssm-param": {
    type: "String",
    value: 'app-dev1.metrist.io',
    name: "apiEndpoints/appAPI"
  },
  "api-endpoints-backend-api-ssm-param": {
    type: "String",
    value: 'app-dev1.metrist.io',
    name: "apiEndpoints/backendAPI"
  },
  // TODO - Still used by Teams api
  "api-endpoints-teams-api-ssm-param": {
    type: "String",
    value: 'teamsapi-dev.canarymonitor.com',
    name: "apiEndpoints/teamsAPI"
  },
  "api-endpoints-telemetry-api-ssm-param": {
    type: "String",
    value: 'app-dev1.metrist.io',
    name: "apiEndpoints/telemetryAPI"
  },
  "backend-ssm-param": {
    type: "String",
    value: '{"container":{"version":"68cf3af"}}',
    name: "backend"
  },
  "canary-wildcard-cert-arn-ssm-param": {
    type: "String",
    value: 'arn:aws:acm:us-east-1:123456789:certificate/07136af4-854d-47de-af1b-4eb9adb86149',
    name: "canaryWildcardCertArn"
  },
  "backend-container-ssm-param": {
    type: "String",
    value: '{"version":"68cf3af"}',
    name: "backend/container"
  },
  "backend-container-version-ssm-param": {
    type: "String",
    value: '68cf3af',
    name: "backend/container/version"
  },
  "database-logical-name-ssm-param": {
    type: "String",
    value: 'dev',
    name: "database/logicalName"
  },
  "email-default-from-email-ssm-param": {
    type: "String",
    value: 'support@metrist.io',
    name: "email/defaultFromEmail"
  },
  "email-new-private-monitor-alert-emails-ssm-param": {
    type: "String",
    value: ' ',
    name: "email/newPrivateMonitorAlertEmails"
  },
  "internal-ops-channel-ssm-param": {
    type: "String",
    value: '#ops-dev',
    name: "internal/opsChannel"
  },
  "monitors-ec2-ssm-param": {
    type: "String",
    value: '{"amiId":"ami-0739f8cdb239fe9ae","persistentInstanceId":"i-0a9cd6386ce4162d2"}',
    name: "monitors/ec2"
  },
  "monitors-ec2-ami-id-ssm-param": {
    type: "String",
    value: 'ami-0739f8cdb239fe9ae',
    name: "monitors/ec2/amiId"
  },
  "monitors-ec2-persistent-instance-id-ssm-param": {
    type: "String",
    value: 'i-0a9cd6386ce4162d2',
    name: "monitors/ec2/persistentInstanceId"
  },
  "monitors-enable-cleanup-ssm-param": {
    type: "String",
    value: 'false',
    name: "monitors/enableCleanup"
  },
  "monitors-pagerduty-ssm-param": {
    type: "String",
    value: '{"serviceId":"PS7AR2J"}',
    name: "monitors/pagerduty"
  },
  "monitors-pagerduty-service-id-ssm-param": {
    type: "String",
    value: 'PS7AR2J',
    name: "monitors/pagerduty/serviceId"
  },
  "stacks-datadog-alerting-stack-name-ssm-param": {
    type: "String",
    value: 'datadog-alerting',
    name: "stacks/datadogAlertingStackName"
  },
  "stacks-error-log-pattern-ssm-param": {
    type: "String",
    value: 'Exception',
    name: "stacks/errorLogPattern"
  },
  "stacks-roles-stack-name-ssm-param": {
    type: "String",
    value: 'roles-stack',
    name: "stacks/rolesStackName"
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
    value: 'true',
    name: "stacks/enableStatusPageObservers"
  },
  "stacks-error-log-handler-stack-name-ssm-param": {
    type: "String",
    value: 'error-logs',
    name: "stacks/errorLogHandlerStackName"
  },
  "stacks-monitors-only-ssm-param": {
    type: "String",
    value: 'false',
    name: "stacks/monitorsOnly"
  },
  "stacks-pager-duty-sms-stack-name-ssm-param": {
    type: "String",
    value: 'monitor-pdsms',
    name: "stacks/pagerDutySMSStackName"
  },
  "stacks-pagerduty-alerting-stack-name-ssm-param": {
    type: "String",
    value: 'pagerduty-alerting',
    name: "stacks/pagerdutyAlertingStackName"
  },
  "stacks-sentry-stack-name-ssm-param": {
    type: "String",
    value: 'monitor-sentry',
    name: "stacks/sentryStackName"
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
  "stacks-enable-timers-ssm-param": {
    type: "String",
    value: 'true',
    name: "stacks/enableTimers"
  },
  "stacks-github-stack-name-ssm-param": {
    type: "String",
    value: 'monitor-github',
    name: "stacks/githubStackName"
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
  "stacks-slack-alerting-stack-name-ssm-param": {
    type: "String",
    value: 'slack-alerting',
    name: "stacks/slackAlertingStackName"
  }
}
