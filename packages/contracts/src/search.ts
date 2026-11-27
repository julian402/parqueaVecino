import { z } from 'zod';
import { Amenity, SearchSort, Shift, VehicleType } from './enums';

/** `ROOF,CAMERAS` en la URL → `['ROOF', 'CAMERAS']`. */
const commaSeparatedAmenities = z.preprocess(
  (value) => (typeof value === 'string' ? value.split(',').filter(Boolean) : (value ?? undefined)),
  z.array(z.enum(Amenity)).optional(),
);

/** Búsqueda de cupos alrededor de un punto (pantalla 2 del mockup). */
export const searchQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  /** Si no llega, se usa `search.defaultRadiusMeters` de system_settings. */
  radiusMeters: z.coerce.number().int().positive().max(50_000).optional(),
  shift: z.enum(Shift),
  vehicleType: z.enum(VehicleType),
  maxPriceMinor: z.coerce.number().int().positive().optional(),
  amenities: commaSeparatedAmenities,
  sort: z.enum(SearchSort).default(SearchSort.PRICE),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchQueryInput = z.input<typeof searchQuerySchema>;

/** Cupo que coincide con la franja y el vehículo buscados. */
export const searchOfferSchema = z.object({
  shift: z.enum(Shift),
  vehicleType: z.enum(VehicleType),
  availableSpots: z.number().int(),
  totalSpots: z.number().int(),
  monthlyPriceMinor: z.number().int(),
  currency: z.string().length(3),
});
export type SearchOffer = z.infer<typeof searchOfferSchema>;

export const searchResultSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  neighborhood: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  verified: z.boolean(),
  amenities: z.array(z.enum(Amenity)),
  /** Portada del parqueadero (null = imagen provisional). */
  photo: z.string().nullable(),
  distanceMeters: z.number().int(),
  offer: searchOfferSchema,
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  totalLots: z.number().int(),
  /** Cupos libres sumando todos los resultados (encabezado "31 cupos nocturnos libres"). */
  totalAvailableSpots: z.number().int(),
  radiusMeters: z.number().int(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

/** Texto libre ("Chapinero", "Calle 72 con 7") → coordenadas. */
export const geocodeQuerySchema = z.object({
  q: z.string().trim().min(3).max(120),
});
export type GeocodeQuery = z.infer<typeof geocodeQuerySchema>;

export const geocodeResultSchema = z.object({
  label: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});
export type GeocodeResult = z.infer<typeof geocodeResultSchema>;
