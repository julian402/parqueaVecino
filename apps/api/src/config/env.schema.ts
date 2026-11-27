import { parseDurationToSeconds } from '@parqueavecino/utils';
import { z } from 'zod';

const duration = z.string().refine(
  (value) => {
    try {
      return parseDurationToSeconds(value) > 0;
    } catch {
      return false;
    }
  },
  { message: 'Duración inválida (usa por ejemplo 15m, 12h, 7d)' },
);

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const commaSeparatedList = z
  .string()
  .min(1)
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

/**
 * Única fuente de configuración de la API. Si falta o es inválida una variable,
 * la app no arranca. Toda variable nueva se agrega aquí y en `.env.example`.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive(),
  API_PREFIX: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Solo si otra web (otro origen) consume la API. La web propia usa el mismo origen (/api). */
  CORS_ORIGINS: commaSeparatedList.optional(),
  SWAGGER_ENABLED: booleanFromString,
  APP_TIMEZONE: z.string().min(1),
  APP_LOCALE: z.string().min(2),
  APP_CURRENCY: z.string().length(3),

  DATABASE_URL: z.url(),
  /** disable (local) | require (cifra sin validar) | verify-full (cifra y valida con la CA). */
  DATABASE_SSL: z.enum(['disable', 'require', 'verify-full']).default('disable'),
  /** Certificado de la CA (p. ej. bundle de RDS). Obligatorio con verify-full. */
  DATABASE_SSL_CA_FILE: z.string().optional(),
  /** Segundos que se cachean los parámetros de negocio (system_settings). */
  SETTINGS_CACHE_TTL_SECONDS: z.coerce.number().int().min(0),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: duration,
  JWT_REFRESH_TTL: duration,
  /** true cuando la app se sirve por HTTPS (en AWS va detrás de CloudFront). */
  COOKIE_SECURE: booleanFromString,

  /** Geocodificador (Nominatim de OpenStreetMap por defecto: gratis, sin llave). */
  GEOCODER_URL: z.url(),
  /** Nominatim exige identificar la app; no incluir datos personales. */
  GEOCODER_USER_AGENT: z.string().min(5),
  GEOCODER_COUNTRY_CODES: z.string().min(2),
  /** Media caja (en grados) alrededor de search.defaultCenter para priorizar resultados. */
  GEOCODER_BIAS_DEGREES: z.coerce.number().positive().max(5),
  GEOCODER_CACHE_TTL_SECONDS: z.coerce.number().int().min(0),
  GEOCODER_TIMEOUT_MS: z.coerce.number().int().positive(),

  // ---- Se vuelven obligatorias cuando se use cada servicio (ver docs/PLAN.md) ----
  // Fase 2: fotos en S3.
  S3_REGION: z.string().min(1).optional(),
  S3_ENDPOINT: z.url().optional(),
  S3_FORCE_PATH_STYLE: booleanFromString.default(false),
  S3_BUCKET_UPLOADS: z.string().min(3).optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Fase 3: correos.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  MAIL_FROM: z.string().min(3).optional(),
  // Fase 5: tiempo real y colas.
  REDIS_URL: z.url().optional(),
  // Fase 3: pagos. Solo llaves de prueba: el proyecto no procesa pagos reales.
  // Vacío o "disabled" (valor inicial del secreto en AWS) = pagos deshabilitados.
  STRIPE_SECRET_KEY: z
    .union([z.string().startsWith('sk_test_'), z.literal(''), z.literal('disabled')])
    .optional()
    .transform((value) => (value?.startsWith('sk_test_') ? value : undefined)),
  /** Firma de los webhooks (whsec_...). En local la imprime `stripe listen`. */
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform((value) => (value && value !== 'disabled' ? value : undefined)),
  /**
   * País de las cuentas conectadas de los aliados (Stripe Connect), p. ej. US. Vacío = Stripe lo
   * pregunta en el onboarding. Colombia no está disponible en Connect: en modo test se usa US.
   */
  STRIPE_CONNECT_COUNTRY: z
    .string()
    .optional()
    .transform((value) => value?.trim().toUpperCase() || undefined)
    .pipe(z.string().length(2).optional()),
  /** URL pública de la web: a ella vuelve el aliado al terminar el onboarding de pagos. */
  WEB_URL: z.url().optional(),
  /** Cada cuánto se liberan cupos de reservas sin pagar y se vencen mensualidades (0 = nunca). */
  BOOKINGS_SWEEP_INTERVAL_SECONDS: z.coerce.number().int().min(0).default(60),

  // ---------- Límite de intentos (login, registro, refresh) ----------
  /** Ventana del límite, en segundos. */
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  /** Peticiones de autenticación permitidas por IP dentro de la ventana. */
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  /**
   * Proxies delante de la API (Caddy en AWS = 1). Con 0 se usa la IP de la conexión; sin
   * esto, detrás de un proxy todos los clientes compartirían la IP del proxy y su límite.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
});

export type Env = z.infer<typeof envSchema>;

const refinedEnvSchema = envSchema.refine(
  (env) => env.DATABASE_SSL !== 'verify-full' || Boolean(env.DATABASE_SSL_CA_FILE),
  {
    message: 'DATABASE_SSL_CA_FILE es obligatorio con verify-full',
    path: ['DATABASE_SSL_CA_FILE'],
  },
);

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = refinedEnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return result.data;
}
