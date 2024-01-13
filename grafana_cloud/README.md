Grafana 
---- 

We use `make grafana` to sync our dev dashboard to prod. To run the command you must first set
`GRAFANA_EDITOR_API_TOKEN` environment variable which you can find in AWS Secrets Manager `/<env>/grafana/credentials` 
