const { default: axios } = require('axios')
const jsondiffpatch = require('jsondiffpatch')
const readline = require('readline')
const util = require('util')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const creds = process.env.GRAFANA_EDITOR_API_TOKEN
if (!creds) {
  throw 'Please set GRAFANA_EDITOR_API_TOKEN'
}

const prodId = 'W60RWS4nk'
const devId = 'Z7wr2zKnk'

const slackOpsDevId = 'L6SlXV4nz'
const slackOpsProdId = 'ZFiru447z'

// This is pretty much the simplest thing that could possible work; an edit script.
// Two things were tried before doing this:
//  - Jsonnet/Grafonnet: this introduces a complete new programming language, a bit heavy-handed for
//    just a dashboard;
//  - Uber's grafana-dash-gen: simple, but did not support some of the constructs we were already using. Does
//    not look very maintained.
function devToProd(_key: string, value: any) {
  if (typeof (value) != 'string') {
    return value
  }

  return value
    .replace(slackOpsDevId, slackOpsProdId)
    .replace(/us-east-1/g, 'us-west-2')
    .replace(/Development/g, 'Production')
    .replace(/development/g, 'production')
    .replace(/dev1/g, 'prod')
    .replace(/\bdevelop\b/g, 'main')
}

async function main() {
  const base = 'https://metrist.grafana.net/api/dashboards'
  const auth = { 'Authorization': `Bearer ${creds}` }
  const url = (id: string) => `${base}/uid/${id}`
  console.log("Fetching dashboard from " + url(devId))
  const devResp = await axios.get(url(devId), { headers: auth })
  const prodResp = await axios.get(url(prodId), { headers: auth })
  // This is a bit silly. We have resp.data parsed, but we want to have it parsed
  // with or function. So back through the parser it is.
  const prod = JSON.parse(JSON.stringify(devResp.data.dashboard), devToProd)
  const update = {
    folderId: prodResp.data.meta.folderId,
    folderUid: prodResp.data.meta.folderUid,
    overwrite: true,
    message: 'Updated by infra script',
    dashboard: {
      ...prod,
      uid: prodResp.data.dashboard.uid,
      id: prodResp.data.dashboard.id
    }
  }
  jsondiffpatch.console.log(jsondiffpatch.diff(prodResp.data.dashboard, update.dashboard));
  rl.question('Do you wish to apply these changes (Y/n)', async (answer: string) => {
    if (answer !== 'Y') process.exit(0)
    rl.close();
    console.log("Update", JSON.stringify(update, null, 2))
    await axios.post(`${base}/db`, update, { headers: auth })
  })
}

main()
