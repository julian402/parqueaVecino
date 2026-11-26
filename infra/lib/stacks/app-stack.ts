import path from 'node:path';
import {
  CfnOutput,
  Duration,
  IgnoreMode,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';
import type { EnvironmentConfig } from '../../config';

export interface AppStackProps extends StackProps {
  config: EnvironmentConfig;
  vpc: ec2.IVpc;
  appSecurityGroup: ec2.ISecurityGroup;
  albSecurityGroup: ec2.ISecurityGroup;
  database: rds.DatabaseInstance;
}

const REPO_ROOT = path.join(import.meta.dirname, '..', '..', '..');

/**
 * Web + API en una sola tarea Fargate detrás de un ALB, con CloudFront delante (HTTPS gratis).
 *   CloudFront ──► ALB ──► /api/*  → contenedor api
 *                      └─► resto   → contenedor web
 * Al compartir origen, las cookies de sesión son de primera parte y no se necesita CORS.
 */
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    const { app, appSettings } = props.config;
    const dbSecret = props.database.secret;
    if (!dbSecret) throw new Error('La base de datos debe tener secreto generado');

    // ---------- Secretos generados (nunca en el código ni en el repo) ----------
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      description: 'Firma de los access tokens (JWT)',
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const seedSecret = new secretsmanager.Secret(this, 'SeedSecret', {
      description: 'Contraseña del admin y de los usuarios demo creados por el seed',
      generateSecretString: { passwordLength: 20, excludePunctuation: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ---------- Tarea: web + api ----------
    const logGroup = new logs.LogGroup(this, 'Logs', {
      retention: app.logRetentionDays as logs.RetentionDays,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'Task', {
      cpu: app.cpu,
      memoryLimitMiB: app.memoryMiB,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    const imageOptions = { ignoreMode: IgnoreMode.DOCKER, platform: Platform.LINUX_AMD64 };

    taskDefinition.addContainer('api', {
      image: ecs.ContainerImage.fromAsset(REPO_ROOT, {
        ...imageOptions,
        file: 'apps/api/Dockerfile',
      }),
      portMappings: [{ containerPort: app.apiPort }],
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'api' }),
      environment: {
        NODE_ENV: 'production',
        API_PORT: String(app.apiPort),
        API_PREFIX: appSettings.apiPrefix,
        LOG_LEVEL: appSettings.logLevel,
        SWAGGER_ENABLED: String(appSettings.swaggerEnabled),
        APP_TIMEZONE: appSettings.timezone,
        APP_LOCALE: appSettings.locale,
        APP_CURRENCY: appSettings.currency,
        SETTINGS_CACHE_TTL_SECONDS: String(appSettings.settingsCacheTtlSeconds),
        JWT_ACCESS_TTL: appSettings.jwtAccessTtl,
        JWT_REFRESH_TTL: appSettings.jwtRefreshTtl,
        COOKIE_SECURE: 'true',
        DATABASE_SSL: 'verify-full',
        DATABASE_SSL_CA_FILE: '/app/certs/rds-global-bundle.pem',
        RUN_MIGRATIONS_ON_START: String(app.runMigrationsOnStart),
        RUN_SEED_ON_START: String(app.runSeedOnStart),
        SEED_ADMIN_EMAIL: appSettings.seedAdminEmail,
        SEED_DEMO_DATA: String(app.seedDemoData),
      },
      secrets: {
        DB_HOST: ecs.Secret.fromSecretsManager(dbSecret, 'host'),
        DB_PORT: ecs.Secret.fromSecretsManager(dbSecret, 'port'),
        DB_NAME: ecs.Secret.fromSecretsManager(dbSecret, 'dbname'),
        DB_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        JWT_ACCESS_SECRET: ecs.Secret.fromSecretsManager(jwtSecret),
        SEED_ADMIN_PASSWORD: ecs.Secret.fromSecretsManager(seedSecret),
        SEED_DEMO_PASSWORD: ecs.Secret.fromSecretsManager(seedSecret),
      },
    });

    taskDefinition.addContainer('web', {
      image: ecs.ContainerImage.fromAsset(REPO_ROOT, {
        ...imageOptions,
        file: 'apps/web/Dockerfile',
        buildArgs: {
          NEXT_PUBLIC_API_URL: `/${appSettings.apiPrefix}`,
          NEXT_PUBLIC_APP_LOCALE: appSettings.locale,
          NEXT_PUBLIC_APP_TIMEZONE: appSettings.timezone,
          NEXT_PUBLIC_APP_CURRENCY: appSettings.currency,
        },
      }),
      portMappings: [{ containerPort: app.webPort }],
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'web' }),
      environment: { PORT: String(app.webPort) },
    });

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc: props.vpc });
    const service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: app.desiredCount,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [props.appSecurityGroup],
      circuitBreaker: { rollback: true },
      // Margen para migraciones + seed antes de que el ALB evalúe la salud.
      healthCheckGracePeriod: Duration.minutes(3),
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // ---------- Balanceador (su grupo de seguridad vive en el stack de red) ----------
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });
    const listener = alb.addListener('Http', { port: 80, open: false });

    listener.addTargets('Web', {
      port: app.webPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service.loadBalancerTarget({ containerName: 'web', containerPort: app.webPort })],
      healthCheck: { path: '/', healthyHttpCodes: '200' },
      deregistrationDelay: Duration.seconds(10),
    });
    listener.addTargets('Api', {
      priority: 10,
      conditions: [elbv2.ListenerCondition.pathPatterns([`/${appSettings.apiPrefix}/*`])],
      port: app.apiPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service.loadBalancerTarget({ containerName: 'api', containerPort: app.apiPort })],
      healthCheck: { path: '/health', healthyHttpCodes: '200' },
      deregistrationDelay: Duration.seconds(10),
    });

    // ---------- CloudFront: HTTPS con dominio *.cloudfront.net ----------
    const albOrigin = new origins.LoadBalancerV2Origin(alb, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    });
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: `ParqueaVecino ${props.config.name}`,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: albOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      additionalBehaviors: {
        // Archivos con hash de Next: se pueden cachear sin riesgo.
        '/_next/static/*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
    });

    new CfnOutput(this, 'Url', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'SeedSecretName', {
      value: seedSecret.secretName,
      description: 'Contraseña del admin y usuarios demo',
    });
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new CfnOutput(this, 'ServiceName', { value: service.serviceName });
  }
}
