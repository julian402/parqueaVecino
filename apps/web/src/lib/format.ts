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
