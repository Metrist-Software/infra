

export ENVIRONMENT_TAG ?= dev1
# https://github.com/hashicorp/terraform-cdk/issues/1559
export TERRAFORM_BINARY_NAME ?= $(shell asdf which terraform)

SRC_DIRS = . src grafana grafana_cloud
TS_SRC = $(shell find ${SRC_DIRS} -maxdepth 1 -name '*.ts' -a ! -name '*.d.ts')
GEN_JS = $(TS_SRC:.ts=.js)
GEN_TS = $(TS_SRC:.ts=.d.ts)

.PHONY: dev watch plan synth apply init show grafana_cloud

CDK_TF_JSON = cdktf.out/stacks/infra-${ENVIRONMENT_TAG}/cdk.tf.json

dev: setup
	make CMD=init runtf
	echo "Use 'make plan/apply' to run Terraform. Happy hacking!"

setup: clean
	asdf install
	npm ci
	npx cdktf get

clean:
	-rm -rf cdktf.out .gen node_modules ${GEN_JS} ${GEN_TS}

watch:
	ls main.ts src/*.ts|entr npx cdktf synth

synth: $(CDK_TF_JSON)

${CDK_TF_JSON}: *.json ${TS_SRC}
	npx cdktf synth

init show plan apply: ${CDK_TF_JSON}
	make CMD=$@ runtf

runtf:
    # TODO properly figure out stack name. But CDK only seems to leave just the
    # last stack in place.
	cd cdktf.out/stacks/infra*; terraform ${CMD}

grafana_cloud: grafana_cloud/main.js
	node grafana_cloud/main.js

grafana_cloud/main.js: grafana_cloud/main.ts
	npx tsc
