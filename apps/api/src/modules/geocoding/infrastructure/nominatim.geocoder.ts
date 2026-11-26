import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { GeocodeResult } from '@parqueavecino/contracts';
import { z } from 'zod';
import { AppConfigService } from '../../../config/app-config.service';
import { Geocoder, type GeocodeRequest } from '../domain/geocoder';

/** Partes del nombre que se muestran: "Chapinero, Localidad Chapinero, Bogotá". */
const LABEL_PARTS = 3;

const nominatimResponseSchema = z.array(
  z.object({
    display_name: z.string(),
    lat: z.coerce.number(),
    lon: z.coerce.number(),
  }),
);

/**
 * Adaptador de Nominatim (OpenStreetMap): gratis, sin llave.
 * Política de uso: identificarse con User-Agent, cachear y no superar 1 consulta/s
 * (la caché de GeocodingService evita repetir consultas).
 */
@Injectable()
export class NominatimGeocoder extends Geocoder {
  private readonly logger = new Logger(NominatimGeocoder.name);

  constructor(private readonly config: AppConfigService) {
    super();
  }

  async geocode({ query, near, limit }: GeocodeRequest): Promise<GeocodeResult[]> {
    const bias = this.config.get('GEOCODER_BIAS_DEGREES');
    const url = new URL('search', this.config.get('GEOCODER_URL'));
    url.search = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: String(limit),
      countrycodes: this.config.get('GEOCODER_COUNTRY_CODES'),
      'accept-language': this.config.get('APP_LOCALE'),
      // Caja alrededor de la ciudad: prioriza resultados cercanos sin excluir los demás.
      viewbox: [
        near.longitude - bias,
        near.latitude + bias,
        near.longitude + bias,
        near.latitude - bias,
      ].join(','),
    }).toString();

    let body: unknown;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': this.config.get('GEOCODER_USER_AGENT') },
        signal: AbortSignal.timeout(this.config.get('GEOCODER_TIMEOUT_MS')),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      body = await response.json();
    } catch (error) {
      this.logger.warn({ err: error }, 'El geocodificador no respondió');
      throw new ServiceUnavailableException('No pudimos ubicar esa dirección. Intenta de nuevo.');
    }

    // Nominatim devuelve nombres largos y repetidos (UPZ, localidad…): se acortan y se deduplican.
    const unique = new Map<string, GeocodeResult>();
    for (const place of nominatimResponseSchema.parse(body)) {
      const label = place.display_name.split(',').slice(0, LABEL_PARTS).join(',').trim();
      if (!unique.has(label)) {
        unique.set(label, { label, latitude: place.lat, longitude: place.lon });
      }
    }
    return [...unique.values()];
  }
}
