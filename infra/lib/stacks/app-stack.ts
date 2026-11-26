import path from 'node:path';
import {
  CfnOutput,
  Duration,
  IgnoreMode,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';
import type { EnvironmentConfig } from '../../config';

export interface AppStackProps extends StackProps {
  config: EnvironmentConfig;
  vpc: ec2.IVpc;
  appSecurityGroup: ec2.ISecurityGroup;
  database: rds.DatabaseInstance;
}

const REPO_ROOT = path.join(import.meta.dirname, '..', '..', '..');
const HTTP_PORT = 80;
const HTTPS_PORT = 443;
/** Donde Caddy guarda certificados (XDG_DATA_HOME de la imagen oficial). */
const CADDY_DATA_PATH = '/data';

/** Health check de contenedor con el fetch de Node (las imágenes no traen curl). */
function httpHealthCheck(url: string, startPeriod: Duration): ecs.HealthCheck {
  return {
    command: [
      'CMD',
      'node',
      '-e',
      `fetch('${url}').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))`,
    ],
    interval: Duration.seconds(15),
    timeout: Duration.seconds(5),
    retries: 3,
    startPeriod,
  };
}

/**
 * Una tarea Fargate con tres contenedores que comparten localhost:
 *
 *   Internet ──► caddy :80/:443 ──► /api/*, /health → api :3001
 *                (HTTPS, Let's Encrypt)  └──────────► resto → web :3000
 *
 * Sin ALB ni CloudFront (DuckDNS solo admite IPs): la tarea publica su IP en DuckDNS al arrancar.
 * Web y API comparten origen, así que las cookies son de primera parte y no se necesita CORS.
 * Limitación aceptada: una sola tarea; durante un despliegue hay segundos de cambio de IP.
 */
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    const { app, appSettings, domain, geocoder } = props.config;
    const dbSecret = props.database.secret;
    if (!dbSecret) throw new Error('La base de datos debe tener secreto generado');

    // ---------- Secretos (nunca en el código ni en el repo) ----------
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
    // Se crea con un valor provisional; el token real de DuckDNS se carga a mano (ver README).
    const duckDnsSecret = new secretsmanager.Secret(this, 'DuckDnsToken', {
      description: `Token de DuckDNS para ${domain.name}`,
      generateSecretString: { passwordLength: 36, excludePunctuation: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ---------- Almacenamiento de certificados (EFS) ----------
    const efsSecurityGroup = new ec2.SecurityGroup(this, 'CertsSecurityGroup', {
      vpc: props.vpc,
      description: 'EFS de certificados: solo la app',
      allowAllOutbound: false,
    });
    efsSecurityGroup.addIngressRule(props.appSecurityGroup, ec2.Port.tcp(2049), 'App hacia EFS');
    const certificates = new efs.FileSystem(this, 'Certificates', {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: efsSecurityGroup,
      encrypted: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ---------- Entrada pública: solo HTTP/HTTPS hacia Caddy ----------
    // Reglas declaradas en este stack para no tocar el de red en cada cambio de la app.
    for (const port of [HTTP_PORT, HTTPS_PORT]) {
      new ec2.CfnSecurityGroupIngress(this, `PublicIngress${port}`, {
        groupId: props.appSecurityGroup.securityGroupId,
        cidrIp: '0.0.0.0/0',
        ipProtocol: 'tcp',
        fromPort: port,
        toPort: port,
        description: `Internet hacia Caddy (${port})`,
      });
    }

    // ---------- Tarea ----------
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
    taskDefinition.addVolume({
      name: 'certificates',
      efsVolumeConfiguration: {
        fileSystemId: certificates.fileSystemId,
        transitEncryption: 'ENABLED',
        authorizationConfig: { iam: 'ENABLED' },
      },
    });
    certificates.grantRootAccess(taskDefinition.taskRole);

    const imageOptions = { ignoreMode: IgnoreMode.DOCKER, platform: Platform.LINUX_AMD64 };

    const api = taskDefinition.addContainer('api', {
      image: ecs.ContainerImage.fromAsset(REPO_ROOT, {
        ...imageOptions,
        file: 'apps/api/Dockerfile',
      }),
      portMappings: [{ containerPort: app.apiPort }],
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'api' }),
      // Margen para migraciones + seed al arrancar.
      healthCheck: httpHealthCheck(`http://localhost:${app.apiPort}/health`, Duration.minutes(3)),
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
        GEOCODER_URL: geocoder.url,
        GEOCODER_USER_AGENT: geocoder.userAgent,
        GEOCODER_COUNTRY_CODES: geocoder.countryCodes,
        GEOCODER_BIAS_DEGREES: String(geocoder.biasDegrees),
        GEOCODER_CACHE_TTL_SECONDS: String(geocoder.cacheTtlSeconds),
        GEOCODER_TIMEOUT_MS: String(geocoder.timeoutMs),
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

    const web = taskDefinition.addContainer('web', {
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
      healthCheck: httpHealthCheck(`http://localhost:${app.webPort}/`, Duration.minutes(1)),
      environment: { PORT: String(app.webPort) },
    });

    const caddy = taskDefinition.addContainer('caddy', {
      image: ecs.ContainerImage.fromAsset(path.join(REPO_ROOT, 'docker', 'caddy'), {
        platform: Platform.LINUX_AMD64,
      }),
      portMappings: [{ containerPort: HTTP_PORT }, { containerPort: HTTPS_PORT }],
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'caddy' }),
      environment: {
        APP_DOMAIN: domain.name,
        DUCKDNS_SUBDOMAIN: domain.duckdnsSubdomain,
        API_PREFIX: appSettings.apiPrefix,
        API_PORT: String(app.apiPort),
        WEB_PORT: String(app.webPort),
      },
      secrets: { DUCKDNS_TOKEN: ecs.Secret.fromSecretsManager(duckDnsSecret) },
    });
    caddy.addMountPoints({
      sourceVolume: 'certificates',
      containerPath: CADDY_DATA_PATH,
      readOnly: false,
    });
    // El dominio solo apunta a esta tarea cuando la web y la API ya responden.
    caddy.addContainerDependencies(
      { container: api, condition: ecs.ContainerDependencyCondition.HEALTHY },
      { container: web, condition: ecs.ContainerDependencyCondition.HEALTHY },
    );

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc: props.vpc });
    const service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: app.desiredCount,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [props.appSecurityGroup],
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    new CfnOutput(this, 'Url', { value: `https://${domain.name}` });
    new CfnOutput(this, 'DuckDnsSecretName', {
      value: duckDnsSecret.secretName,
      description: 'Cargar aquí el token real de DuckDNS',
    });
    new CfnOutput(this, 'SeedSecretName', {
      value: seedSecret.secretName,
      description: 'Contraseña del admin y usuarios demo',
    });
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new CfnOutput(this, 'ServiceName', { value: service.serviceName });
  }
}
