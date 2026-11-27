import { z } from 'zod';
import { Amenity, ParkingLotStatus, Shift, VehicleType } from './enums';

/** Placa colombiana: carro ABC123, moto ABC12D. Se guarda sin espacios y en mayúscula. */
export const plateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^[A-Z]{3}\d{2}[A-Z\d]$/, 'Placa inválida'));

export const vehicleInputSchema = z.object({
  plate: plateSchema,
  type: z.enum(VehicleType),
  nickname: z.string().trim().max(40).optional(),
});
export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export const vehicleSchema = z.object({
  id: z.uuid(),
  plate: z.string(),
  type: z.enum(VehicleType),
  nickname: z.string().nullable(),
});
export type Vehicle = z.infer<typeof vehicleSchema>;

export const parkingLotInputSchema = z.object({
  name: z.string().trim().min(3).max(120),
  address: z.string().trim().min(5).max(200),
  neighborhood: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  description: z.string().trim().max(1000).optional(),
  amenities: z.array(z.enum(Amenity)).default([]),
});
export type ParkingLotInput = z.infer<typeof parkingLotInputSchema>;

export const parkingLotUpdateSchema = parkingLotInputSchema.partial();
export type ParkingLotUpdate = z.infer<typeof parkingLotUpdateSchema>;

/**
 * Cupos que publica el aliado por franja y tipo de vehículo. Precio en unidades menores.
 * Los cupos libres no se envían: la API los calcula como total − mensualidades vendidas.
 */
export const offerInputSchema = z.object({
  shift: z.enum(Shift),
  vehicleType: z.enum(VehicleType),
  totalSpots: z.number().int().min(0).max(10_000),
  monthlyPriceMinor: z.number().int().positive(),
  active: z.boolean().default(true),
});
export type OfferInput = z.infer<typeof offerInputSchema>;

export const upsertOffersSchema = z.object({
  offers: z
    .array(offerInputSchema)
    .min(1)
    .max(20)
    .refine(
      (offers) => new Set(offers.map((o) => `${o.shift}:${o.vehicleType}`)).size === offers.length,
      { message: 'Hay franjas repetidas para el mismo vehículo' },
    ),
});
export type UpsertOffersInput = z.infer<typeof upsertOffersSchema>;

export const offerSchema = z.object({
  id: z.uuid(),
  shift: z.enum(Shift),
  vehicleType: z.enum(VehicleType),
  totalSpots: z.number().int(),
  availableSpots: z.number().int(),
  monthlyPriceMinor: z.number().int(),
  currency: z.string().length(3),
  active: z.boolean(),
});
export type Offer = z.infer<typeof offerSchema>;

export const parkingLotSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  neighborhood: z.string().nullable(),
  city: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  description: z.string().nullable(),
  amenities: z.array(z.enum(Amenity)),
  /** URLs de las fotos; la primera es la portada. Vacío = imagen provisional. */
  photos: z.array(z.string()),
  status: z.enum(ParkingLotStatus),
  verified: z.boolean(),
  offers: z.array(offerSchema),
});
export type ParkingLot = z.infer<typeof parkingLotSchema>;

/** El aliado solo puede pausar o reanudar un parqueadero ya publicado. */
export const partnerLotStatusSchema = z.object({
  status: z.enum([ParkingLotStatus.ACTIVE, ParkingLotStatus.PAUSED]),
});
export type PartnerLotStatusInput = z.infer<typeof partnerLotStatusSchema>;
