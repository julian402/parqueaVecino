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
