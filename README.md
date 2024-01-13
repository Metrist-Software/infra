# Infra

This repository holds Terraform code to create our infrastructure. As Hashicorp Configuration Language is
an abomination that humans should not have to touch, we use the Typescript CDK incarnation of Terraform
so that we can use a reasonable programming language to structure code.

## Development

`make dev` should set everything up. If you have `entr` installed, then running `make watch` in a terminal
will do the right thing on save (compile your code, run a plan action). `npx cdktf` invokes the CLI.

## Deployment
- There is an [asdf-vm](https://asdf-vm.com/#/) `.tool-versions` file which is the recommended version of terraform cli to be used
- `npx cdktf deploy` does All The Things. [`main.ts`](main.ts) contains configuration per `ENVIRONMENT_TAG`, if
you unset it you should get your own environment with your name in it (`dev-john` for example).

## Other resources

* We use Image Builder to build AMIs. Currently only one pipeline [up North](https://ca-central-1.console.aws.amazon.com/imagebuilder/home?region=ca-central-1).

* You can use pretty much everything in the standard [AWS Module](https://registry.terraform.io/modules/terraform-aws-modules), just
  Typescriptify it. The directory `.gen/providers/aws` has the Typescript definitions for everything. Adding other modules is
  pretty simple.

* Code, docs, examples can be found in the official [Terraform CDK repository](https://github.com/hashicorp/terraform-cdk).

* Instance created use EC2 Instance Connect for ssh logins. [Documentation here](doc/HOWTO-Connect-to-jump-instance.md).
