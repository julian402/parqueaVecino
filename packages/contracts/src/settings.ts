import { z } from 'zod';
import { Shift, VehicleType } from './enums';

const timeOfDay = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/, 'Formato HH:mm');

/**
 * Parámetros de negocio guardados en la tabla `system_settings`.
 * Cada clave tiene su esquema: el valor se valida al leerlo y al editarlo.
 */
export const settingsSchemas = {
  /** Comisión que se cobra al parqueadero, en puntos básicos (1000 = 10 %). */
  'commission.basisPoints': z.number().int().min(0).max(10_000),
  /** Horario de cada franja. */
  'shift.schedule': z.record(z.enum(Shift), z.object({ start: timeOfDay, end: timeOfDay })),
  /** Tope de precio mensual por tipo de vehículo (unidades menores), según Decreto 098 de 2024. */
  'pricing.monthlyCapMinor': z.record(z.enum(VehicleType), z.number().int().positive()),
  /** Horas antes del inicio en que la cancelación es gratuita. */
  'booking.freeCancellationHours': z.number().int().min(0),
  /** Minutos que un cupo queda apartado mientras el conductor paga; luego se libera. */
  'booking.paymentHoldMinutes': z
    .number()
    .int()
    .min(5)
    .max(24 * 60),
  /** Días antes del fin de una mensualidad en que se avisa al conductor para renovarla. */
  'booking.expiryNoticeDays': z.number().int().min(1).max(30),
  /** Días antes del vencimiento de un documento (póliza) en que se avisa al aliado. */
  'verification.expiryNoticeDays': z.number().int().min(1).max(90),
  /** Tamaño máximo de cada documento de verificación, en bytes. */
  'verification.maxFileBytes': z
    .number()
    .int()
    .min(100 * 1024)
    .max(25 * 1024 * 1024),
  /** Radio de búsqueda por defecto, en metros. */
  'search.defaultRadiusMeters': z.number().int().positive(),
  /** Punto donde abre el mapa si el usuario no da ubicación (y sesgo del geocodificador). */
  'search.defaultCenter': z.object({
    label: z.string().min(2),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  /** Opciones del filtro "Hasta $X" por tipo de vehículo (unidades menores). */
  'search.priceFiltersMinor': z.record(
    z.enum(VehicleType),
    z.array(z.number().int().positive()).max(6),
  ),
} as const;

export type SettingKey = keyof typeof settingsSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingsSchemas)[K]>;
export const SETTING_KEYS = Object.keys(settingsSchemas) as SettingKey[];

/** Claves que la web puede leer sin autenticarse. */
export const PUBLIC_SETTING_KEYS = [
  'shift.schedule',
  'booking.freeCancellationHours',
  'search.defaultRadiusMeters',
  'search.defaultCenter',
  'search.priceFiltersMinor',
] as const satisfies readonly SettingKey[];

export const publicSettingsSchema = z.object({
  'shift.schedule': settingsSchemas['shift.schedule'],
  'booking.freeCancellationHours': settingsSchemas['booking.freeCancellationHours'],
  'search.defaultRadiusMeters': settingsSchemas['search.defaultRadiusMeters'],
  'search.defaultCenter': settingsSchemas['search.defaultCenter'],
  'search.priceFiltersMinor': settingsSchemas['search.priceFiltersMinor'],
});
export type PublicSettings = z.infer<typeof publicSettingsSchema>;
