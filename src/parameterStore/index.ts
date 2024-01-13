import { SsmParameter, SsmParameterConfig } from "../../.gen/providers/aws/ssm-parameter";
import { Context } from "../../main";
import { dev1 } from "./dev1";
import { prod } from "./prod";
import { prod2 } from "./prod2";
import { prodMonUSEast1 } from "./prodMonUSEast1";
import { prodMonUSWest1 } from "./prodMonUSWest1";

export type ParamConfig = Record<string, SsmParameterConfig>

export class ParameterStore {
    static configs: Record<string, ParamConfig> = {
        "dev1": dev1,
        "prod-mon-us-east-1": prodMonUSEast1,
        "prod-mon-us-west-1": prodMonUSWest1,
        "prod": prod,
        "prod2": prod2
    }

    constructor(public context: Context) {
        Object.entries(ParameterStore.configs[context.environment]).map(([id, parameterConfig]) => {
            new SsmParameter(context.scope, id, {
                ...parameterConfig,
                name: `/${context.environment}/${parameterConfig.name}`
            })
        })
    }

}

