import { describe, expect, it } from 'vitest';
import { addDaysToDate, dateInTimeZone, hourInTimeZone } from './date';

describe('fechas en la zona de la app', () => {
  it('usa la fecha de Bogotá aunque en UTC ya sea el día siguiente', () => {
    // 2026-03-02 03:00 UTC = 2026-03-01 22:00 en Bogotá (UTC-5).
    const instant = new Date('2026-03-02T03:00:00Z');
    expect(dateInTimeZone(instant, 'America/Bogota')).toBe('2026-03-01');
    expect(dateInTimeZone(instant, 'UTC')).toBe('2026-03-02');
    expect(hourInTimeZone(instant, 'America/Bogota')).toBe(22);
  });

  it('suma días cruzando meses y años', () => {
    expect(addDaysToDate('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToDate('2026-12-25', 20)).toBe('2027-01-14');
    expect(addDaysToDate('2026-03-01', -1)).toBe('2026-02-28');
  });
});
