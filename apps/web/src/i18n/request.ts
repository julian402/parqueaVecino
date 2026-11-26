import { getRequestConfig } from 'next-intl/server';
import { env } from '@/env';

/** Los mensajes se cargan por idioma (es-CO → messages/es.json). */
export default getRequestConfig(async () => {
  const locale = env.NEXT_PUBLIC_APP_LOCALE;
  const language = locale.split('-')[0];
  const messages = (await import(`../../messages/${language}.json`)) as {
    default: Record<string, unknown>;
  };
  return { locale, timeZone: env.NEXT_PUBLIC_APP_TIMEZONE, messages: messages.default };
});
