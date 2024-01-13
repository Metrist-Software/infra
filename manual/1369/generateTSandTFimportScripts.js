#!/usr/bin/env node

/**
 * Creates a file that contains the followign:
 * -  TypeScript object that represents an SSMParamterConcfig. 
 * -  Terraform import commands to import existing SSM params
 * 
 * 
 *   ENVIRONMENT_TAG=dev ./generateTSandTFimportScripts.js
 *   ENVIRONMENT_TAG=prod-mon-us-east-1 ./generateTSandTFimportScripts.js
 */

const { execSync } = require("child_process");
const { writeFileSync } = require("fs");
const { tmpdir } = require("os");
const path = require("path");

const environmentTag = process.env.ENVIRONMENT_TAG;
const environmentTagPrefix = `/${environmentTag}/`

switch (environmentTag) {
  case "dev1":
  case "prod-mon-us-east-1":
    process.env.AWS_DEFAULT_REGION = "us-east-1";
    break;
  case 'prod-mon-us-west-1':
    process.env.AWS_DEFAULT_REGION = "us-west-1";
    break;
  case "prod":
    process.env.AWS_DEFAULT_REGION = "us-west-2";
    break;
  case "prod2":
    process.env.AWS_DEFAULT_REGION = "us-east-2";
    break;
  default:
    console.error("Invalid environment tag");
    process.exit(1);
}

function execAndParse(command) {
  return JSON.parse(execSync(command).toString())
}

function buildResourceID(str) {
  return str
    .replace(environmentTagPrefix, "")
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    .map(x => x.toLowerCase())
    .join('-')
    .replace(/\//g, "-")
    .toLowerCase() + "-ssm-param"
}


function buildTS(parameters, valuesByPath) {
  const entries = parameters
    .map(({ Name, Type }) => {
      return `
      "${buildResourceID(Name)}": {
        type: "${Type}",
        value: '${valuesByPath[Name]}',
        name: "${Name.replace(environmentTagPrefix, "")}"
      }`
    })
    .join(",");
  return `/***
  Generated Output. DO NOT MODIFY
  \n{${entries}\n}\n***/`;
}

function buildTFImports(parameters) {
  return parameters.map(({ Name }) => {
    return `terraform import aws_ssm_parameter.${buildResourceID(Name)} ${Name}`
  }).join("\n")
}

function* chunks(arr, n) {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}


function main(params) {
  const { Parameters: parameters } = execAndParse(`aws ssm describe-parameters \
    --parameter-filters "Key=Path,Option=Recursive,Values=${environmentTagPrefix}"`);

  const valuesByPath = [...chunks(parameters, 10)]
    .flatMap((params) => {
      return execAndParse(`aws ssm get-parameters \
    --names ${params.map(({ Name }) => Name).join(" ")} \
    --query "Parameters[*].{Name:Name,Value:Value}"`);
    })
    .reduce((prev, curr) => ({ ...prev, [curr.Name]: curr.Value }), {});

  const outPath = path.join(tmpdir(), `${environmentTag}.txt`);

  writeFileSync(outPath, [buildTS(parameters, valuesByPath), buildTFImports(parameters, valuesByPath)].join("\n\n"));

  console.log("Output generated to: ", outPath);
}


main();

