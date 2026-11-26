import { Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';
import type { EnvironmentConfig } from '../../config';

export interface NetworkStackProps extends StackProps {
  config: EnvironmentConfig;
}

/** VPC base. Con natGateways = 0 las subredes privadas quedan aisladas (sin salida a internet). */
export class NetworkStack extends Stack {
  readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);
    const { network } = props.config;

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: network.maxAzs,
      natGateways: network.natGateways,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        {
          name: 'private',
          subnetType:
            network.natGateways > 0
              ? ec2.SubnetType.PRIVATE_WITH_EGRESS
              : ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });
  }
}
