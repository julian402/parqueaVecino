import { Injectable } from '@nestjs/common';
import type { GeocodeResult } from '@parqueavecino/contracts';
import { AppConfigService } from '../../../config/app-config.service';
import { SettingsService } from '../../settings/application/settings.service';
import { Geocoder } from '../domain/geocoder';

/** Sugerencias que se muestran al buscar un lugar. */
export const MAX_GEOCODE_RESULTS = 5;

interface CacheEntry {
  expiresAt: number;
  results: GeocodeResult[];
}

/**
 * Geocodifica con caché en memoria: las búsquedas se repiten mucho ("Chapinero", "Calle 72")
 * y el proveedor gratuito pide no repetir consultas idénticas.
 */
@Injectable()
export class GeocodingService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly geocoder: Geocoder,
    private readonly settings: SettingsService,
    private readonly config: AppConfigService,
  ) {}

  async geocode(query: string, now = Date.now()): Promise<GeocodeResult[]> {
    const key = query.trim().toLocaleLowerCase();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) return cached.results;

    const center = await this.settings.get('search.defaultCenter');
    const results = await this.geocoder.geocode({
      query,
      near: { latitude: center.latitude, longitude: center.longitude },
      limit: MAX_GEOCODE_RESULTS,
    });

    this.cache.set(key, {
      results,
      expiresAt: now + this.config.get('GEOCODER_CACHE_TTL_SECONDS') * 1000,
    });
    return results;
  }
}
