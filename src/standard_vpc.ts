import { BaseModule } from './base_module'
import { Context } from '../main'
import { Token } from 'cdktf'


import { Vpc } from "../.gen/providers/aws/vpc"
import { InternetGateway } from "../.gen/providers/aws/internet-gateway"
import { Subnet } from "../.gen/providers/aws/subnet"
import { DefaultRouteTable } from "../.gen/providers/aws/default-route-table"
import { RouteTable } from "../.gen/providers/aws/route-table"
import { NatGateway } from "../.gen/providers/aws/nat-gateway"
import { RouteTableAssociation } from "../.gen/providers/aws/route-table-association"
import { Eip } from "../.gen/providers/aws/eip"

import { azMapping, standardTags } from './common'

// Creates a "standard VPC with 2 private and 2 public subnets across AZ's with nat gateways and an internet gateway
//
// TODO move the prefix allocation spreadsheet into code, and add IPv6

export class StandardVpc extends BaseModule {
  // Expose vars for each created resource as caller will likely want to modify them
  vpc: Vpc
  tags: Record<string, string>
  name: string
  igw: InternetGateway
  privateSubnets: Subnet[]
  publicSubnets: Subnet[]
  natGateways: NatGateway[]
  privateRouteTables: RouteTable[]
  publicRouteTable: RouteTable
  defaultRouteTable: DefaultRouteTable

  constructor(context: Context, name: string, cidrBlock : string, privateSubnetCidrBlocks: string[], publicSubnetCidrBlocks: string[], )  {
    super(context)

    if (
      privateSubnetCidrBlocks.length > azMapping[this.context.region].length
      || publicSubnetCidrBlocks.length > azMapping[this.context.region].length) {
      throw new Error(`privateSubnetCidrBlocks && publicSubnetCidrBlocks length cannot be greater than ${azMapping[this.context.region].length} for region ${this.context.region}`)
    }

    this.name = name
    this.tags = standardTags(context.environment, name)

    this.vpc = new Vpc(context.scope, this.makeName('0'), {
      cidrBlock: cidrBlock,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: {
        ...this.tags,
        Name: this.makeName('0')
      },
      ...this.preventDestroy()
    })
    // Internet Gateway
    this.igw = new InternetGateway(context.scope, this.makeName('igw'), {
      vpcId: Token.asString(this.vpc.id),
      tags: this.tags
    })
    this.defaultRouteTable = new DefaultRouteTable(context.scope, this.makeName('rt'), {
      defaultRouteTableId: Token.asString(this.vpc.defaultRouteTableId),
      tags: {
        ...this.tags,
        Name: this.makeName('rt')
      },
      route: [],
      ...this.preventDestroy()
    })

    this.privateSubnets = privateSubnetCidrBlocks.map((cidrBlock, index) =>
      new Subnet(context.scope, this.makeName(`priv-sn${index}`), {
        vpcId: Token.asString(this.vpc.id),
        availabilityZone: azMapping[context.region][index],
        cidrBlock: cidrBlock,
        tags: {
          ...this.tags,
          Name: this.makeName(`priv-sn${index}`)
        },
        ...this.preventDestroy()
      })
    );

    this.publicSubnets = publicSubnetCidrBlocks.map((cidrBlock, index) =>
      new Subnet(context.scope, this.makeName(`pub-sn${index}`), {
        vpcId: Token.asString(this.vpc.id),
        availabilityZone: azMapping[context.region][index],
        cidrBlock: cidrBlock,
        tags: {
          ...this.tags,
          Name: this.makeName(`pub-sn${index}`)
        },
        ...this.preventDestroy()
      })
    );

    const eIps = this.publicSubnets.map((_subnet, index) =>
      new Eip(context.scope, this.makeName(`eip${index}`), {
        vpc: true,
        tags: {
          ...this.tags,
          Name: this.makeName(`eip${index}`)
        },
      })
    )

    // Create a nat for all public subnets
    this.natGateways = this.publicSubnets.map((subnet, index) =>
      new NatGateway(context.scope, this.makeName(`nat${index}`), {
        allocationId: Token.asString(eIps[index].id),
        subnetId: Token.asString(subnet.id),
        connectivityType: `public`,
        tags: {
          ...this.tags,
          Name: this.makeName(`nat${index}`)
        },
      })
    );

    //Route private subnet 0.0.0.0 to nats
    this.privateRouteTables = this.natGateways.map((natGateway, index) =>
      new RouteTable(context.scope, this.makeName(`rt-priv${index}`), {
        vpcId: Token.asString(this.vpc.id),
        tags: {
          ...this.tags,
          Name: this.makeName(`rt-priv${index}`)
        },
        route: [
          {
            cidrBlock: '0.0.0.0/0',
            gatewayId: Token.asString(natGateway.id)
          }
        ]
      })
    );

    this.privateSubnets.map((subnet, index) =>
      new RouteTableAssociation(context.scope, this.makeName(`rta-priv${index}`), {
        subnetId: Token.asString(subnet.id),
        routeTableId: Token.asString(this.privateRouteTables[index].id)
      })
    )

    // Route public 0.0.0.0 to internet gateway
    this.publicRouteTable = new RouteTable(context.scope, this.makeName(`rt-pub`), {
      vpcId: Token.asString(this.vpc.id),
      tags: {
        ...this.tags,
        Name: this.makeName(`rt-pub`)
      },
    route: [
        {
          cidrBlock: '0.0.0.0/0',
          gatewayId: Token.asString(this.igw.id)
        }
      ]
    })

    this.publicSubnets.map((subnet, index) =>
      new RouteTableAssociation(context.scope, this.makeName(`rta-pub${index}`), {
        subnetId: Token.asString(subnet.id),
        routeTableId: Token.asString(this.publicRouteTable.id)
      })
    )
  }

  protected makeName(part: string) {
    return `${this.context.environment}-backend-${this.name}-${part}`
  }
}
