//
// A common base module for some common functions used by module implementations (backend/alerting currently)
//
//
import { Context } from '../main'
import { TerraformMetaArguments } from 'cdktf'

export abstract class BaseModule {

  protected context: Context
  constructor(context: Context){
    this.context = context
  }

  protected makeName(part: string) {
    return `${this.context.environment}-backend-${part}`
  }

  protected makeHostName(domainName: string) {
    const env = this.context.environment;
    return `app${env == 'prod' ? '' : `-${env}`}.${domainName}`
  }

  protected isProduction() {
    return this.context.environment.startsWith('prod')
  }

  protected isPrecious() {
    return this.isProduction() || this.context.environment == 'dev1'
  }

  // Probably can be done more "meta" but that won't prevent typos
  protected createBeforeDestroy: TerraformMetaArguments = { lifecycle: { createBeforeDestroy: true } }
  protected preventDestroy(): TerraformMetaArguments {
    if (!this.isPrecious()) {
      return {}
    }
    else {
      return { lifecycle: { preventDestroy: true } }
    }
  }
}
