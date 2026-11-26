import type { SearchResult } from '@parqueavecino/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsService } from '../../settings/application/settings.service';
import type { LotSearchCriteria, ParkingLotsRepository } from '../domain/parking-lots.repository';
import { MAX_SEARCH_RESULTS, ParkingSearchService } from './parking-search.service';

const result = (id: string, availableSpots: number): SearchResult => ({
  id,
  name: `Parqueadero ${id}`,
  address: 'Cra 13 # 63-21',
  neighborhood: 'Chapinero',
  latitude: 4.6486,
  longitude: -74.0631,
  verified: true,
  amenities: [],
  distanceMeters: 300,
  offer: {
    shift: 'NIGHT',
    vehicleType: 'CAR',
    availableSpots,
    totalSpots: 20,
    monthlyPriceMinor: 17_000_000,
    currency: 'COP',
  },
});

function setup(results: SearchResult[] = []) {
  const search = vi.fn((_criteria: LotSearchCriteria) => Promise.resolve(results));
  const repository = { search } as unknown as ParkingLotsRepository;
  const settings = { get: vi.fn(() => Promise.resolve(1500)) } as unknown as SettingsService;
  return { service: new ParkingSearchService(repository, settings), search };
}

const baseQuery = {
  lat: 4.6486,
  lng: -74.0631,
  shift: 'NIGHT',
  vehicleType: 'CAR',
  sort: 'PRICE',
} as const;

describe('ParkingSearchService', () => {
  it('usa el radio por defecto de system_settings si no llega en la consulta', async () => {
    const { service, search } = setup();
    const response = await service.search(baseQuery);
    expect(response.radiusMeters).toBe(1500);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ radiusMeters: 1500, amenities: [], limit: MAX_SEARCH_RESULTS }),
    );
  });

  it('respeta el radio y los filtros enviados', async () => {
    const { service, search } = setup();
    await service.search({
      ...baseQuery,
      radiusMeters: 3000,
      maxPriceMinor: 20_000_000,
      amenities: ['ROOF'],
    });
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        radiusMeters: 3000,
        maxPriceMinor: 20_000_000,
        amenities: ['ROOF'],
      }),
    );
  });

  it('suma los cupos libres de todos los resultados', async () => {
    const { service } = setup([result('a', 5), result('b', 0), result('c', 7)]);
    const response = await service.search(baseQuery);
    expect(response.totalLots).toBe(3);
    expect(response.totalAvailableSpots).toBe(12);
  });
});
