export type TimeZoneFormatOptions = Intl.DateTimeFormatOptions & {
  locale: string;
  timeZone: string;
};

/** Formatea una fecha en la zona horaria de la app (APP_TIMEZONE), nunca en la del servidor. */
export function formatInTimeZone(
  date: Date,
  { locale, timeZone, ...options }: TimeZoneFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(date);
}

/** Hora local (0-23) de una fecha en la zona indicada. */
export function hourInTimeZone(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(date)
    .find((part) => part.type === 'hour')?.value;
  return Number(hour);
}

/** Fecha calendario (AAAA-MM-DD) de un instante en la zona indicada. */
export function dateInTimeZone(date: Date, timeZone: string): string {
  // en-CA formatea como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Suma días a una fecha calendario (AAAA-MM-DD), sin depender de la zona del servidor. */
export function addDaysToDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
