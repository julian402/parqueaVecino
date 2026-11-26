import { z } from 'zod';

/**
 * Variables públicas del front. Next solo expone NEXT_PUBLIC_* si se leen de forma literal,
 * por eso se listan una por una. Toda variable nueva va aquí y en `.env.example`.
 */
const schema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_APP_LOCALE: z.string().min(2),
  NEXT_PUBLIC_APP_TIMEZONE: z.string().min(1),
  NEXT_PUBLIC_APP_CURRENCY: z.string().length(3),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_LOCALE: process.env.NEXT_PUBLIC_APP_LOCALE,
  NEXT_PUBLIC_APP_TIMEZONE: process.env.NEXT_PUBLIC_APP_TIMEZONE,
  NEXT_PUBLIC_APP_CURRENCY: process.env.NEXT_PUBLIC_APP_CURRENCY,
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Variables de entorno inválidas en apps/web:\n${issues}`);
}

export const env = parsed.data;
