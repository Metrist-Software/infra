.PHONY: dev watch plan synth apply init show grafana_cloud

export GRAFANA_INSTALL_REGION ?= us-east-1
export GRAFANA_INSTALL_SUBDOMAIN ?= grafana
export GRAFANA_INSTALL_AWS_ACCOUNT_ID ?= 123456789

CDK_TF_JSON = cdktf.out/stacks/grafana-${GRAFANA_INSTALL_REGION}/cdk.tf.json

dev:
	npm ci
	npx cdktf get
	npx cdktf synth
	make CMD=init runtf
	echo "Use 'make plan/apply' to run Terraform. Happy hacking!"

synth: $(CDK_TF_JSON)

${CDK_TF_JSON}: *.ts
	npx cdktf synth

init show plan apply destroy: ${CDK_TF_JSON}
	make CMD=$@ runtf

runtf:
    # TODO properly figure out stack name. But CDK only seems to leave just the
    # last stack in place.
	cd cdktf.out/stacks/grafana*; terraform ${CMD}

