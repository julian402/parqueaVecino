import { Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';
import type { EnvironmentConfig } from '../../config';

/** Rangos de IP de CloudFront hacia orígenes (lista administrada por AWS). */
const CLOUDFRONT_PREFIX_LIST = 'com.amazonaws.global.cloudfront.origin-facing';

export interface NetworkStackProps extends StackProps {
  config: EnvironmentConfig;
}

/**
 * VPC y grupos de seguridad compartidos.
 * Sin NAT: las tareas van en subred pública (con IP pública) y la BD en subred aislada.
 */
export class NetworkStack extends Stack {
  readonly vpc: ec2.Vpc;
  /** Lo usan las tareas de la app; la BD solo acepta conexiones desde este grupo. */
  readonly appSecurityGroup: ec2.SecurityGroup;
  /** ALB público: solo acepta tráfico desde CloudFront. */
  readonly albSecurityGroup: ec2.SecurityGroup;

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

    this.appSecurityGroup = new ec2.SecurityGroup(this, 'AppSecurityGroup', {
      vpc: this.vpc,
      description: 'Tareas de la app (web + api)',
      allowAllOutbound: true,
    });

    // Ambos grupos viven aquí: el ALB abre reglas hacia la app y así no hay referencias cíclicas.
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      description: 'ALB: solo CloudFront',
      allowAllOutbound: true,
    });
    const cloudFront = ec2.PrefixList.fromLookup(this, 'CloudFrontPrefixList', {
      prefixListName: CLOUDFRONT_PREFIX_LIST,
    });
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.prefixList(cloudFront.prefixListId),
      ec2.Port.tcp(80),
      'CloudFront hacia el ALB',
    );
  }
}
