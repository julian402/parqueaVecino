import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';
import type { EnvironmentConfig } from '../../config';

export interface DataStackProps extends StackProps {
  config: EnvironmentConfig;
  vpc: ec2.IVpc;
  appSecurityGroup: ec2.ISecurityGroup;
}

/** PostgreSQL (RDS) con PostGIS. Credenciales generadas en Secrets Manager. */
export class DataStack extends Stack {
  readonly database: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    const { database } = props.config;

    const securityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: props.vpc,
      description: 'PostgreSQL: solo acepta conexiones de la app',
      allowAllOutbound: false,
    });
    securityGroup.addIngressRule(
      props.appSecurityGroup,
      ec2.Port.tcp(5432),
      'App hacia PostgreSQL',
    );

    // Contraseña solo alfanumérica: así va directo en la URL de conexión sin escapar.
    // RDS completa el secreto con host, puerto y nombre de la BD al adjuntarlo.
    const credentials = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      description: `PostgreSQL ${props.config.name}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: database.username }),
        generateStringKey: 'password',
        passwordLength: 32,
        excludePunctuation: true,
      },
      removalPolicy: database.destroyOnRemoval ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    this.database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.of(
          database.postgresMajorVersion,
          database.postgresMajorVersion,
        ),
      }),
      instanceType: ec2.InstanceType.of(
        database.instanceClass as ec2.InstanceClass,
        database.instanceSize as ec2.InstanceSize,
      ),
      vpc: props.vpc,
      vpcSubnets: { subnetGroupName: 'private' },
      securityGroups: [securityGroup],
      publiclyAccessible: false,
      multiAz: false,
      databaseName: database.databaseName,
      credentials: rds.Credentials.fromSecret(credentials),
      allocatedStorage: database.allocatedStorageGb,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      backupRetention: Duration.days(database.backupRetentionDays),
      deletionProtection: database.deletionProtection,
      removalPolicy: database.destroyOnRemoval ? RemovalPolicy.DESTROY : RemovalPolicy.SNAPSHOT,
      autoMinorVersionUpgrade: true,
    });
  }
}
