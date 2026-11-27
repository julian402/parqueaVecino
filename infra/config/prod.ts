import type { EnvironmentConfig } from './types';

/**
 * "Producción de pruebas": URL pública, pero Stripe en modo test (pagos ficticios) y datos demo.
 * Único ambiente en AWS por presupuesto (créditos educativos): lo más económico posible.
 * El desarrollo diario se hace en local con Docker.
 */
export const prod: EnvironmentConfig = {
  name: 'prod',
  account: process.env.CDK_DEFAULT_ACCOUNT,
  // La organización de la cuenta solo permite us-east-2 (SCP); otras regiones son denegadas.
  region: 'us-east-2',

  network: { maxAzs: 2, natGateways: 0 },

  database: {
    postgresMajorVersion: '17',
    instanceClass: 't4g',
    instanceSize: 'micro',
    allocatedStorageGb: 20,
    backupRetentionDays: 1,
    databaseName: 'parqueavecino',
    username: 'parqueavecino',
    deletionProtection: false,
    destroyOnRemoval: true,
  },

  domain: {
    name: 'parquea-vecino.duckdns.org',
    duckdnsSubdomain: 'parquea-vecino',
  },

  app: {
    cpu: 256,
    memoryMiB: 1024,
    desiredCount: 1,
    apiPort: 3001,
    webPort: 3000,
    logRetentionDays: 7,
    runMigrationsOnStart: true,
    runSeedOnStart: true,
    seedDemoData: true,
  },

  appSettings: {
    apiPrefix: 'api',
    locale: 'es-CO',
    timezone: 'America/Bogota',
    currency: 'COP',
    logLevel: 'info',
    swaggerEnabled: true,
    settingsCacheTtlSeconds: 60,
    jwtAccessTtl: '15m',
    jwtRefreshTtl: '7d',
    seedAdminEmail: 'admin@parqueavecino.local',
    stripeConnectCountry: 'US',
    mapStyleUrl: 'https://tiles.openfreemap.org/styles/positron',
    // Llave publicable (pública por diseño). La secreta va en Secrets Manager, nunca aquí.
    stripePublishableKey:
      'pk_test_51Ug3u1HkrNz3wZ9aqeub2fGaobCZ1Qw5CoATnFneXIzTBrZ1zQ5fq3BVLvPHtV3UHWT5ZFrzYTqLHuPZS8LCU7y0009jn4dCTP',
  },

  geocoder: {
    url: 'https://nominatim.openstreetmap.org/',
    userAgent: 'ParqueaVecino/0.1 (proyecto academico)',
    countryCodes: 'co',
    biasDegrees: 0.3,
    cacheTtlSeconds: 86_400,
    timeoutMs: 5000,
  },

  github: {
    owner: 'julian402',
    repo: 'parqueaVecino',
    deployBranch: 'main',
    deployEnvironment: 'prod',
    ownerId: 101749051,
    repoId: 1473453037,
  },

  monthlyBudgetUsd: 30,
  tags: { project: 'parqueavecino', environment: 'prod' },
};
