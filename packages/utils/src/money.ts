export interface MoneyFormatOptions {
  /** Locale BCP 47, p. ej. el valor de APP_LOCALE. */
  locale: string;
  /** Mostrar decimales (en COP normalmente no se muestran centavos). */
  showFractionDigits?: boolean;
}

/** Decimales que define ISO 4217 para la moneda (COP = 2, JPY = 0, ...). */
export function currencyFractionDigits(currency: string): number {
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
