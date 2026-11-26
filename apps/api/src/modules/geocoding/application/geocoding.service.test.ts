import type { GeocodeResult } from '@parqueavecino/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../../../config/app-config.service';
import type { SettingsService } from '../../settings/application/settings.service';
import type { GeocodeRequest, Geocoder } from '../domain/geocoder';
import { GeocodingService, MAX_GEOCODE_RESULTS } from './geocoding.service';

const chapinero: GeocodeResult = { label: 'Chapinero, Bogotá', latitude: 4.65, longitude: -74.06 };
const TTL_SECONDS = 60;

function setup() {
  const geocode = vi.fn((_request: GeocodeRequest) => Promise.resolve([chapinero]));
  const geocoder = { geocode } as unknown as Geocoder;
  const settings = {
    get: vi.fn(() => Promise.resolve({ label: 'Bogotá', latitude: 4.6486, longitude: -74.0631 })),
  } as unknown as SettingsService;
  const config = { get: () => TTL_SECONDS } as unknown as AppConfigService;
  return { service: new GeocodingService(geocoder, settings, config), geocode };
}

describe('GeocodingService', () => {
  it('sesga la búsqueda hacia el centro configurado en system_settings', async () => {
    const { service, geocode } = setup();
    await expect(service.geocode('Chapinero')).resolves.toEqual([chapinero]);
    expect(geocode).toHaveBeenCalledWith({
      query: 'Chapinero',
      near: { latitude: 4.6486, longitude: -74.0631 },
      limit: MAX_GEOCODE_RESULTS,
    });
  });

  it('reutiliza la caché para la misma consulta (sin importar mayúsculas)', async () => {
    const { service, geocode } = setup();
    await service.geocode('Chapinero', 0);
    await service.geocode('  chapinero ', 1000);
    expect(geocode).toHaveBeenCalledTimes(1);
  });

  it('vuelve a consultar cuando la caché vence', async () => {
    const { service, geocode } = setup();
    await service.geocode('Chapinero', 0);
    await service.geocode('Chapinero', TTL_SECONDS * 1000 + 1);
    expect(geocode).toHaveBeenCalledTimes(2);
  });
});
