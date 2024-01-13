import { ParamConfig } from ".";

export const prod: ParamConfig = {
    "analyzers-enabled-ssm-param": {
        type: "String",
        value: 'true',
        name: "analyzersEnabled"
    },
    "backend-ssm-param": {
        type: "String",
        value: '{"container":{"version":"14704ad"}}',
        name: "backend"
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
        value: '{"ec2":{"amiId":"ami-06e54d05255faf8f6","persistentInstanceId":"i-0d31fe4e12614fa3c"},"enableCleanup":"true","pagerduty":{"serviceId":"P0022EJ"}}',
        name: "monitors"
    },
    "stacks-ssm-param": {
        type: "String",
        value: '{"alertingStackName":"alerting-stack","datadogAlertingStackName":"datadog-alerting","emailAlertingStackName":"email-alerting","enableStatusPageObservers":"true","enableTimers":"true","errorLogHandlerStackName":"error-logs","errorLogPattern":"Exception","githubStackName":"monitor-github","herokuStackName":"monitor-heroku","kmsStackName":"kms-stack","monitorsOnly":"false","networkStackName":"network-stack","pagerDutySMSStackName":"monitor-pdsms","pagerDutyStackName":"monitor-pagerduty","pagerdutyAlertingStackName":"pagerduty-alerting","rolesStackName":"roles-stack","sentryStackName":"monitor-sentry","slackAlertingStackName":"slack-alerting","teamsAlertingStackName":"teams-alerting","webhooksAlertingStackName":"webhooks-alerting"}',
        name: "stacks"
    },
    "webapp-hostname-ssm-param": {
        type: "String",
        value: 'app.metrist.io',
        name: "webappHostname"
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
    "canary-wildcard-cert-arn-ssm-param": {
        type: "String",
        value: 'arn:aws:acm:us-west-2:123456789:certificate/82a110b8-557f-4eb6-ad7d-2a06e65cd8ca',
        name: "canaryWildcardCertArn"
    },
    "webapp-root-ssm-param": {
        type: "String",
        value: 'https://app.metrist.io',
        name: "webappRoot"
    },
    "backend-container-ssm-param": {
        type: "String",
        value: '{"version":"14704ad"}',
        name: "backend/container"
    },
    "backend-container-version-ssm-param": {
        type: "String",
        value: '14704ad',
        name: "backend/container/version"
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
        value: '{"amiId":"ami-06e54d05255faf8f6","persistentInstanceId":"i-0d31fe4e12614fa3c"}',
        name: "monitors/ec2"
    },
    "monitors-ec2-ami-id-ssm-param": {
        type: "String",
        value: 'ami-06e54d05255faf8f6',
        name: "monitors/ec2/amiId"
    },
    "monitors-ec2-persistent-instance-id-ssm-param": {
        type: "String",
        value: 'i-0d31fe4e12614fa3c',
        name: "monitors/ec2/persistentInstanceId"
    },
    "monitors-enable-cleanup-ssm-param": {
        type: "String",
        value: 'true',
        name: "monitors/enableCleanup"
    },
    "monitors-pagerduty-ssm-param": {
        type: "String",
        value: '{"serviceId":"P0022EJ"}',
        name: "monitors/pagerduty"
    },
    "monitors-pagerduty-service-id-ssm-param": {
        type: "String",
        value: 'P0022EJ',
        name: "monitors/pagerduty/serviceId"
    },
    "stacks-monitors-only-ssm-param": {
        type: "String",
        value: 'false',
        name: "stacks/monitorsOnly"
    },
    "stacks-pagerduty-alerting-stack-name-ssm-param": {
        type: "String",
        value: 'pagerduty-alerting',
        name: "stacks/pagerdutyAlertingStackName"
    },
    "stacks-datadog-alerting-stack-name-ssm-param": {
        type: "String",
        value: 'datadog-alerting',
        name: "stacks/datadogAlertingStackName"
    },
    "stacks-email-alerting-stack-name-ssm-param": {
        type: "String",
        value: 'email-alerting',
        name: "stacks/emailAlertingStackName"
    },
    "stacks-enable-timers-ssm-param": {
        type: "String",
        value: 'true',
        name: "stacks/enableTimers"
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
    "stacks-sentry-stack-name-ssm-param": {
        type: "String",
        value: 'monitor-sentry',
        name: "stacks/sentryStackName"
    },
    "stacks-slack-alerting-stack-name-ssm-param": {
        type: "String",
        value: 'slack-alerting',
        name: "stacks/slackAlertingStackName"
    },
    "stacks-webhooks-alerting-stack-name-ssm-param": {
        type: "String",
        value: 'webhooks-alerting',
        name: "stacks/webhooksAlertingStackName"
    },
    "stacks-alerting-stack-name-ssm-param": {
        type: "String",
        value: 'alerting-stack',
        name: "stacks/alertingStackName"
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
    "stacks-error-log-pattern-ssm-param": {
        type: "String",
        value: 'Exception',
        name: "stacks/errorLogPattern"
    },
    "stacks-github-stack-name-ssm-param": {
        type: "String",
        value: 'monitor-github',
        name: "stacks/githubStackName"
    },
    "stacks-pager-duty-sms-stack-name-ssm-param": {
        type: "String",
        value: 'monitor-pdsms',
        name: "stacks/pagerDutySMSStackName"
    },
    "stacks-roles-stack-name-ssm-param": {
        type: "String",
        value: 'roles-stack',
        name: "stacks/rolesStackName"
    },
    "stacks-teams-alerting-stack-name-ssm-param": {
        type: "String",
        value: 'teams-alerting',
        name: "stacks/teamsAlertingStackName"
    }
}
