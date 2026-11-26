export interface MoneyFormatOptions {
  /** Locale BCP 47, p. ej. el valor de APP_LOCALE. */
  locale: string;
  /** Mostrar decimales (en COP normalmente no se muestran centavos). */
  showFractionDigits?: boolean;
}

/**
 * Decimales ISO 4217 de las monedas que usa la app. Se fijan aquí porque el ICU de cada
 * entorno no coincide (Chrome reporta 0 para COP y Node 2), y las unidades menores
 * guardadas en la BD deben interpretarse igual en la API y en el navegador.
 */
const ISO_4217_FRACTION_DIGITS: Readonly<Record<string, number>> = {
  COP: 2,
  USD: 2,
  EUR: 2,
};

/** Decimales que define ISO 4217 para la moneda (COP = 2, JPY = 0, ...). */
export function currencyFractionDigits(currency: string): number {
  const known = ISO_4217_FRACTION_DIGITS[currency.toUpperCase()];
  if (known !== undefined) return known;
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * 10 ** currencyFractionDigits(currency));
}

export function fromMinorUnits(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** currencyFractionDigits(currency);
}

export function formatMoney(
  amountMinor: number,
  currency: string,
  { locale, showFractionDigits = false }: MoneyFormatOptions,
): string {
  const digits = showFractionDigits ? currencyFractionDigits(currency) : 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(fromMinorUnits(amountMinor, currency));
}

/** Porcentaje en puntos básicos (1000 = 10 %) para no operar con flotantes. */
export function percentageOf(amountMinor: number, basisPoints: number): number {
  return Math.round((amountMinor * basisPoints) / 10_000);
}

/** Precio corto para marcadores de mapa: 17.000.000 (COP, unidades menores) → "$170 mil". */
export function formatCompactMoney(
  amountMinor: number,
  currency: string,
  { locale }: Pick<MoneyFormatOptions, 'locale'>,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 0,
  }).format(fromMinorUnits(amountMinor, currency));
}
