import { describe, expect, it } from 'vitest';
import { computeHourlyOccupancy, shiftCovers } from './occupancy';

const schedule = {
  DAY: { start: '06:00', end: '18:00' },
  NIGHT: { start: '18:00', end: '06:00' },
  FULL: { start: '00:00', end: '24:00' },
};
const TZ = 'America/Bogota';

describe('shiftCovers', () => {
  it('franja diurna, nocturna (cruza medianoche) y 24 h', () => {
    expect(shiftCovers(schedule.DAY, 6 * 60)).toBe(true);
    expect(shiftCovers(schedule.DAY, 18 * 60)).toBe(false);
    expect(shiftCovers(schedule.NIGHT, 23 * 60)).toBe(true);
    expect(shiftCovers(schedule.NIGHT, 2 * 60)).toBe(true);
    expect(shiftCovers(schedule.NIGHT, 12 * 60)).toBe(false);
    expect(shiftCovers(schedule.FULL, 0)).toBe(true);
    expect(shiftCovers(schedule.FULL, 23 * 60 + 59)).toBe(true);
  });
});

describe('computeHourlyOccupancy', () => {
  // Un día completo en Bogotá: 2026-05-10 00:00 a 2026-05-11 00:00 (UTC-5).
  const from = new Date('2026-05-10T05:00:00Z');
  const to = new Date('2026-05-11T05:00:00Z');
  const capacity = { DAY: 4, NIGHT: 2, FULL: 0 };

  it('cuenta cada mensualidad solo en las horas de su franja y en hora local', () => {
    const result = computeHourlyOccupancy({
      periods: [
        // Diurna vigente todo el día: ocupa 06:00–17:59.
        { shift: 'DAY', startsAt: new Date('2026-05-01T00:00:00Z'), endsAt: to },
        // Nocturna vigente todo el día: ocupa 00:00–05:59 y 18:00–23:59.
        { shift: 'NIGHT', startsAt: new Date('2026-05-01T00:00:00Z'), endsAt: to },
      ],
      capacity,
      schedule,
      from,
      to,
      timeZone: TZ,
    });

    const at = (hour: number) => result.hours[hour];
    expect(at(8)).toMatchObject({ occupied: 1, capacity: 4, rate: 0.25 });
    expect(at(17)).toMatchObject({ occupied: 1, capacity: 4 });
    expect(at(18)).toMatchObject({ occupied: 1, capacity: 2, rate: 0.5 });
    expect(at(3)).toMatchObject({ occupied: 1, capacity: 2, rate: 0.5 });
    expect(result.peakHour).toBe(0);
    // (12 h × 1/4 + 12 h × 1/2) ponderado por cupos = 24 ocupadas / 72 cupos-hora.
    expect(result.averageRate).toBeCloseTo(24 / 72);
  });

  it('una mensualidad que empezó a mediodía solo cuenta desde esa hora', () => {
    const result = computeHourlyOccupancy({
      periods: [{ shift: 'DAY', startsAt: new Date('2026-05-10T17:00:00Z'), endsAt: to }],
      capacity,
      schedule,
      from,
      to,
      timeZone: TZ,
    });
    expect(result.hours[11]?.occupied).toBe(0); // 11:30 local, aún no empezaba
    expect(result.hours[12]?.occupied).toBe(1); // 12:30 local
    expect(result.peakHour).toBe(12);
  });

  it('sin cupos ni mensualidades devuelve 24 horas en cero', () => {
    const result = computeHourlyOccupancy({
      periods: [],
      capacity: { DAY: 0, NIGHT: 0, FULL: 0 },
      schedule,
      from,
      to,
      timeZone: TZ,
    });
    expect(result.hours).toHaveLength(24);
    expect(result.hours.every((h) => h.rate === 0 && h.capacity === 0)).toBe(true);
    expect(result.peakHour).toBeNull();
    expect(result.averageRate).toBe(0);
  });

  it('promedia varios días', () => {
    const twoDaysFrom = new Date('2026-05-09T05:00:00Z');
    const result = computeHourlyOccupancy({
      // Solo vigente el segundo día.
      periods: [{ shift: 'DAY', startsAt: from, endsAt: to }],
      capacity,
      schedule,
      from: twoDaysFrom,
      to,
      timeZone: TZ,
    });
    expect(result.hours[10]).toMatchObject({ occupied: 0.5, capacity: 4, rate: 0.125 });
  });
});
