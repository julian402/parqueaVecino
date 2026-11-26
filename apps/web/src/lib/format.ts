import { formatMoney } from '@parqueavecino/utils';
import { env } from '@/env';

/** Formatea dinero (unidades menores) con el locale y la moneda de la configuración. */
export function formatPrice(amountMinor: number, currency = env.NEXT_PUBLIC_APP_CURRENCY): string {
  return formatMoney(amountMinor, currency, { locale: env.NEXT_PUBLIC_APP_LOCALE });
}
