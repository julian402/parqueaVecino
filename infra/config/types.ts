/** Parámetros de infraestructura por ambiente. Nada de tamaños quemados en los stacks. */
export interface EnvironmentConfig {
  /** Nombre corto del ambiente: se usa como prefijo de recursos. */
  name: string;
  account?: string;
  region: string;

  network: {
    maxAzs: number;
    /** 0 = sin NAT Gateway (ahorra ~USD 32/mes). Las tareas van en subred pública con IP pública. */
    natGateways: number;
  };

  database: {
    /** Versión mayor de PostgreSQL; RDS elige la menor por defecto. */
    postgresMajorVersion: string;
    /** Clase y tamaño de instancia, p. ej. t4g + micro = db.t4g.micro. */
    instanceClass: string;
    instanceSize: string;
    allocatedStorageGb: number;
    backupRetentionDays: number;
    databaseName: string;
    username: string;
    deletionProtection: boolean;
    /** true: al destruir el stack se borra la BD (solo para ambientes desechables). */
    destroyOnRemoval: boolean;
  };

  /**
   * Dominio público. DuckDNS solo admite registros A (IP), así que la tarea actualiza su IP
   * al arrancar y Caddy obtiene el certificado HTTPS de Let's Encrypt.
   */
  domain: {
    name: string;
    duckdnsSubdomain: string;
  };

  /** Una tarea Fargate con dos contenedores (web + api) para ahorrar costos. */
  app: {
    cpu: number;
    memoryMiB: number;
    desiredCount: number;
    apiPort: number;
    webPort: number;
    logRetentionDays: number;
    /** Migraciones y seed idempotente al arrancar (en prod se movería a una tarea aparte). */
    runMigrationsOnStart: boolean;
    runSeedOnStart: boolean;
    seedDemoData: boolean;
  };

  /** Bucket S3 privado de archivos (documentos de verificación) con URLs prefirmadas. */
  uploads: {
    /** Segundos de validez de las URLs prefirmadas de subida y descarga. */
    presignTtlSeconds: number;
    /** true: al destruir el stack se vacía y borra el bucket (ambientes desechables). */
    destroyOnRemoval: boolean;
  };

  /**
   * Redis para las colas de BullMQ (jobs programados). Corre como contenedor dentro de la misma
   * tarea (sin costo extra); los jobs se vuelven a programar al arrancar, así que no necesita
   * persistencia. Con varias réplicas se cambiaría por ElastiCache.
   */
  jobs: {
    redisImage: string;
    redisMaxMemoryMb: number;
    /** Cada cuánto se revisan vencimientos (avisos de renovación y de documentos), en segundos. */
    expiryCheckIntervalSeconds: number;
  };

  /** Variables no secretas de la app (las secretas van a Secrets Manager). */
  appSettings: {
    apiPrefix: string;
    locale: string;
    timezone: string;
    currency: string;
    logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
    swaggerEnabled: boolean;
    settingsCacheTtlSeconds: number;
    jwtAccessTtl: string;
    jwtRefreshTtl: string;
    seedAdminEmail: string;
    /** País de las cuentas Stripe Connect de los aliados (Colombia no está en Connect). */
    stripeConnectCountry: string;
    /** Estilo del mapa de la web (MapLibre). */
    mapStyleUrl: string;
    /** Llave publicable de Stripe (pk_test_...). Es pública: va en la web al compilar. */
    stripePublishableKey: string;
  };

  /** Geocodificador (texto → coordenadas). Nominatim es gratis; ver su política de uso. */
  geocoder: {
    url: string;
    userAgent: string;
    countryCodes: string;
    biasDegrees: number;
    cacheTtlSeconds: number;
    timeoutMs: number;
  };

  /** Repositorio de GitHub autorizado a desplegar por OIDC. */
  github: {
    owner: string;
    repo: string;
    deployBranch: string;
    /** Ambiente de GitHub del job de despliegue (`environment:` en deploy.yml). */
    deployEnvironment: string;
    /** IDs numéricos del dueño y del repo (GitHub los incluye en el `sub` del token OIDC). */
    ownerId: number;
    repoId: number;
  };

  /** Alerta de AWS Budgets, en USD por mes. */
  monthlyBudgetUsd: number;
  tags: Record<string, string>;
}
