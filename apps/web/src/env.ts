import { z } from 'zod';

/**
 * Variables públicas del front. Next solo expone NEXT_PUBLIC_* si se leen de forma literal,
 * por eso se listan una por una. Toda variable nueva va aquí y en `.env.example`.
 */
const schema = z.object({
  /** Ruta relativa (/api, mismo origen) o URL absoluta. */
  NEXT_PUBLIC_API_URL: z.union([z.string().regex(/^\/[\w-]*$/), z.url()]),
  NEXT_PUBLIC_APP_LOCALE: z.string().min(2),
  NEXT_PUBLIC_APP_TIMEZONE: z.string().min(1),
  NEXT_PUBLIC_APP_CURRENCY: z.string().length(3),
  /** Estilo del mapa (MapLibre). OpenFreeMap: gratis, sin llave, basado en OpenStreetMap. */
  NEXT_PUBLIC_MAP_STYLE_URL: z.url(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_LOCALE: process.env.NEXT_PUBLIC_APP_LOCALE,
  NEXT_PUBLIC_APP_TIMEZONE: process.env.NEXT_PUBLIC_APP_TIMEZONE,
  NEXT_PUBLIC_APP_CURRENCY: process.env.NEXT_PUBLIC_APP_CURRENCY,
  NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Variables de entorno inválidas en apps/web:\n${issues}`);
}

export const env = parsed.data;
