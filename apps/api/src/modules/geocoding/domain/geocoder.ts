import type { GeocodeResult } from '@parqueavecino/contracts';

export interface GeocodeRequest {
  query: string;
  /** Punto hacia el que se sesgan los resultados (la ciudad de operación). */
  near: { latitude: number; longitude: number };
  limit: number;
}

/** Puerto: texto libre → coordenadas. Hoy Nominatim (OpenStreetMap); se puede cambiar de proveedor. */
export abstract class Geocoder {
  abstract geocode(request: GeocodeRequest): Promise<GeocodeResult[]>;
}
