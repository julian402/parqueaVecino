import { z } from 'zod';

/** Días máximos que se pueden consultar en la gráfica de ocupación. */
export const OCCUPANCY_MAX_DAYS = 31;

export const occupancyQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(OCCUPANCY_MAX_DAYS).default(7),
  /** Solo un parqueadero del aliado; sin él, todos. */
  parkingLotId: z.uuid().optional(),
});
export type OccupancyQuery = z.infer<typeof occupancyQuerySchema>;

/** Ocupación promedio de una hora del día (0-23, hora de la app) en el periodo consultado. */
export const hourlyOccupancySchema = z.object({
  hour: z.number().int().min(0).max(23),
  /** Mensualidades vigentes en esa hora (promedio de los días del periodo). */
  occupied: z.number().nonnegative(),
  /** Cupos publicados para esa hora (según la franja de cada cupo). */
  capacity: z.number().nonnegative(),
  /** occupied / capacity (0 si no hay cupos en esa hora). */
  rate: z.number().min(0).max(1),
});
export type HourlyOccupancy = z.infer<typeof hourlyOccupancySchema>;

/** Gráfica de ocupación por hora del panel del aliado (partner-analytics). */
export const partnerOccupancySchema = z.object({
  days: z.number().int(),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  hours: z.array(hourlyOccupancySchema).length(24),
  /** Hora con más ocupación (null si no hubo mensualidades vigentes). */
  peakHour: z.number().int().min(0).max(23).nullable(),
  /** Ocupación promedio del periodo, ponderada por cupos. */
  averageRate: z.number().min(0).max(1),
});
export type PartnerOccupancy = z.infer<typeof partnerOccupancySchema>;
