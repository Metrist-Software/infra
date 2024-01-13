# Error handler

This folder contains our error handler which is subscribed to cloudwatch logs. It then alerts `OPS_CHANNEL` (#ops or #ops-dev) when appropriate.

## Deployment

Initial deployment is done via the main backend terraform class.

Updates are done by `deploy.sh` which will package the lambda to s3 for future backend.ts needs & redeploy the lambda
based on the <env> you pass to it. Pass `no_lambda_update` as the last parameter if you do not want to update the lambda.

Also contains a version with more parameters that you can use to do a custom deploy for things like sandbox testing

Examples:
- `./deploy.sh dev1` (will only update the s3 zip file)
- `./deploy.sh dev1 no_lambda_update` (will update the s3 zip file and update the lambda itself)
- `./deploy.sh test us-east-1 tests3bucket` (will create a error-handler-test.zip, upload it to s3 to a bucket named tests3bucket, and update the lambda)
- `./deploy.sh test us-east-1 tests3bucket no_lambda_update` (will create a error-handler-test.zip, and upload it to s3 to a bucket named tests3bucket but will not update the lambda)
