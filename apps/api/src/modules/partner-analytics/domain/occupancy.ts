import type { HourlyOccupancy, Shift } from '@parqueavecino/contracts';
import { hourInTimeZone } from '@parqueavecino/utils';

const HOUR_MS = 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

/** Horario de una franja ("HH:mm"); si termina antes de empezar, cruza la medianoche. */
export interface ShiftWindow {
  start: string;
  end: string;
}

/** Periodo en que una mensualidad ocupó un cupo de su franja. */
export interface OccupiedPeriod {
  shift: Shift;
  startsAt: Date;
  endsAt: Date;
}

export interface OccupancyResult {
  hours: HourlyOccupancy[];
  peakHour: number | null;
  averageRate: number;
}

function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** ¿La franja cubre ese minuto del día? (24:00 = fin del día). */
export function shiftCovers(window: ShiftWindow, minuteOfDay: number): boolean {
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  if (start === end) return true;
  if (start < end) return minuteOfDay >= start && minuteOfDay < end;
  return minuteOfDay >= start || minuteOfDay < end;
}

/**
 * Ocupación promedio por hora del día en [from, to): se toma una muestra a la mitad de cada
 * hora y se cuentan las mensualidades vigentes cuya franja cubre esa hora, contra los cupos
 * publicados de las franjas que la cubren. La capacidad es la actual (no hay histórico de cupos).
 */
export function computeHourlyOccupancy(input: {
  periods: OccupiedPeriod[];
  capacity: Record<Shift, number>;
  schedule: Record<Shift, ShiftWindow>;
  from: Date;
  to: Date;
  timeZone: string;
}): OccupancyResult {
  const shifts = Object.keys(input.schedule) as Shift[];
  const acc = Array.from({ length: 24 }, () => ({ samples: 0, occupied: 0, capacity: 0 }));

  const firstSample = Math.floor(input.from.getTime() / HOUR_MS) * HOUR_MS + HOUR_MS / 2;
  for (let t = firstSample; t < input.to.getTime(); t += HOUR_MS) {
    if (t < input.from.getTime()) continue;
    const instant = new Date(t);
    const hour = hourInTimeZone(instant, input.timeZone);
    const minute = (hour * 60 + 30) % MINUTES_PER_DAY;
    const covering = new Set(shifts.filter((shift) => shiftCovers(input.schedule[shift], minute)));

    const slot = acc[hour];
    if (!slot) continue;
    slot.samples += 1;
    for (const shift of covering) slot.capacity += input.capacity[shift] ?? 0;
    for (const period of input.periods) {
      if (covering.has(period.shift) && period.startsAt <= instant && instant < period.endsAt) {
        slot.occupied += 1;
      }
    }
  }

  const hours = acc.map((slot, hour) => ({
    hour,
    occupied: slot.samples ? slot.occupied / slot.samples : 0,
    capacity: slot.samples ? slot.capacity / slot.samples : 0,
    rate: slot.capacity > 0 ? Math.min(1, slot.occupied / slot.capacity) : 0,
  }));

  let peakHour: number | null = null;
  for (const entry of hours) {
    if (entry.occupied === 0) continue;
    if (peakHour === null || entry.rate > (hours[peakHour]?.rate ?? 0)) peakHour = entry.hour;
  }
  const totalOccupied = acc.reduce((sum, slot) => sum + slot.occupied, 0);
  const totalCapacity = acc.reduce((sum, slot) => sum + slot.capacity, 0);
  const averageRate = totalCapacity > 0 ? Math.min(1, totalOccupied / totalCapacity) : 0;

  return { hours, peakHour, averageRate };
}
