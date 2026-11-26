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
  CORS_ORIGINS: commaSeparatedList,
  SWAGGER_ENABLED: booleanFromString,
  APP_TIMEZONE: z.string().min(1),
  APP_LOCALE: z.string().min(2),
  APP_CURRENCY: z.string().length(3),

  DATABASE_URL: z.url(),
  /** Segundos que se cachean los parámetros de negocio (system_settings). */
  SETTINGS_CACHE_TTL_SECONDS: z.coerce.number().int().min(0),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: duration,
  JWT_REFRESH_TTL: duration,
  /** true cuando la app se sirve por HTTPS (en AWS va detrás de CloudFront). */
  COOKIE_SECURE: booleanFromString,

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
  // Fase 3: pagos.
  STRIPE_SECRET_KEY: z.string().startsWith('sk_test_').optional().or(z.literal('')),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return result.data;
}
