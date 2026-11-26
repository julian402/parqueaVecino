import { formatCompactMoney, formatDistance, formatMoney } from '@parqueavecino/utils';
import { env } from '@/env';

const locale = env.NEXT_PUBLIC_APP_LOCALE;

/** Formatea dinero (unidades menores) con el locale y la moneda de la configuración. */
export function formatPrice(amountMinor: number, currency = env.NEXT_PUBLIC_APP_CURRENCY): string {
  return formatMoney(amountMinor, currency, { locale });
}

/** Precio corto para marcadores y filtros: "$170 mil". */
export function formatShortPrice(
  amountMinor: number,
  currency = env.NEXT_PUBLIC_APP_CURRENCY,
): string {
  return formatCompactMoney(amountMinor, currency, { locale });
}

/** "350 m", "1,2 km". */
export function formatMeters(meters: number): string {
  return formatDistance(meters, locale);
}

/** "92 %". */
export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    ratio,
  );
}

/** "26 nov 2026" en la zona horaria de la app. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: env.NEXT_PUBLIC_APP_TIMEZONE,
  }).format(new Date(iso));
}

/** "26 nov 2026, 2:30 p. m." en la zona horaria de la app. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: env.NEXT_PUBLIC_APP_TIMEZONE,
  }).format(new Date(iso));
}
