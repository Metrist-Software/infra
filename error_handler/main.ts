
import { Context, APIGatewayProxyResult, CloudWatchLogsEvent, CloudWatchLogsDecodedData, CloudWatchLogsLogEvent } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import axios from 'axios'
import zlib from 'zlib'

const getSlackAPIToken = async function() : Promise<string> {
  console.log("Retrieving Slack API Token")
  const client = new SecretsManagerClient({ region: REGION });
  const secretCommand = new GetSecretValueCommand({ SecretId:`/${ENVIRONMENT_TAG}/slack/api-token` })
  const response = await client.send(secretCommand)
  const jsonResonse = JSON.parse(response.SecretString!)
  return jsonResonse.token as string
}

const REGION = process.env.AWS_REGION
const OPS_CHANNEL = process.env.OPS_CHANNEL
const ENVIRONMENT_TAG = process.env.ENVIRONMENT_TAG
// Using top level await to ensure we only grab the secret once if this lambda environment is reused
// See https://aws.amazon.com/blogs/compute/using-node-js-es-modules-and-top-level-await-in-aws-lambda/
const SLACK_API_TOKEN = await getSlackAPIToken()

const EXCLUDE_PATTERNS = ["METRIST_MONITOR_ERROR", "METRIST_RETRY"]

export const lambdaHandler = async (event: CloudWatchLogsEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const compressedPayload = Buffer.from(event.awslogs.data, 'base64');
  const jsonPayload = zlib.gunzipSync(compressedPayload).toString('utf8');

  const logDetails : CloudWatchLogsDecodedData = JSON.parse(jsonPayload)

  const checkForMessageExclusion = function(logEvent: CloudWatchLogsLogEvent) : boolean {
    return EXCLUDE_PATTERNS.reduce<boolean>((hasExclude, exclude) => hasExclude || logEvent.message.includes(exclude), false)
  }

  const exclude =
    logDetails.logEvents == null ||
    logDetails.logEvents.reduce<boolean>(
      (includesExcludePattern, logEvent) =>
        includesExcludePattern || checkForMessageExclusion(logEvent),
        false
    )

  if (exclude)
  {
    return { statusCode: 200, body: "OK" }
  }

  const response = await axios.post(
    'https://slack.com/api/chat.postMessage',
    {
      channel: OPS_CHANNEL,
      response_type: "in_channel",
      blocks: getMessageBlocks(logDetails)
    },
    {
      headers: {
        'Authorization': `Bearer ${SLACK_API_TOKEN}`,
        'Content-Type': 'application/json; charset=UTF-8',
      }
    }
  )

  if (!response.data.ok) {
    console.log(`Error sending message to Slack. Error was ${response.data.error}. metadata: ${JSON.stringify(response.data.response_metadata)}`)
  }

  return { statusCode: 200, body: "OK" }
};

const getMessageBlocks = function(logDetails : CloudWatchLogsDecodedData) : any[] {
  const logMessages = logDetails.logEvents.map((logEvent) =>
    ({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`${logEvent.message.trim()}\`\`\``
      }
    })
  )

  const returnValue : any[] =
  [
    ({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Error in \`${logDetails.logGroup}\``
      }
    }),
    ...logMessages,
    ({
      type: "context",
      elements: [
        ({
          type: "mrkdwn",
          text: `<${getCloudwatchConsoleUrl(logDetails)}|View log stream in CloudWatch>`
        })
      ]
    })

  ]

  return returnValue;
}
const getCloudwatchConsoleUrl = function(logDetails : CloudWatchLogsDecodedData) : string {
  const logEvent = logDetails.logEvents[0];
  var baseUrl = `https://console.aws.amazon.com/cloudwatch/home?region=${REGION}#logsV2:log-groups/log-group/`;
  var filter = `${doubleEscapeDataString(logDetails.logStream)}${encodeURIComponent("?start=")}${logEvent.timestamp}${encodeURIComponent("&refEventId=")}${doubleEscapeDataString(logEvent.id)}`.replace(/%/g, "$");
  return `${baseUrl}${doubleEscapeDataString(logDetails.logGroup)}/log-events/${filter}`;
}

const doubleEscapeDataString = function(input : string) : string {
  return encodeURIComponent(encodeURIComponent(input))
}

