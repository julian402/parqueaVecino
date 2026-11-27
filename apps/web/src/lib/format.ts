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

/** Fecha calendario sin hora (AAAA-MM-DD), p. ej. el vencimiento de una póliza: "31 ene 2027". */
export function formatCalendarDate(isoDate: string): string {
  // Se formatea en UTC para que la fecha no se corra un día por la zona horaria.
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

/** "850 KB", "2,4 MB". */
export function formatFileSize(bytes: number): string {
  const units = ['byte', 'kilobyte', 'megabyte'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: units[unit],
    unitDisplay: 'short',
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
}

/** "7 a. m." — hora del día (0-23). */
export function formatHour(hour: number): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2000, 0, 1, hour)),
  );
}
