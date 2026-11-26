import { Injectable } from '@nestjs/common';
import type { SearchQuery, SearchResponse } from '@parqueavecino/contracts';
import { SettingsService } from '../../settings/application/settings.service';
import { ParkingLotsRepository } from '../domain/parking-lots.repository';

/** Tope técnico de resultados por consulta (protege la BD y el mapa, no es regla de negocio). */
export const MAX_SEARCH_RESULTS = 100;

/** Pantalla 2: parqueaderos con cupo para la franja y el vehículo, alrededor de un punto. */
@Injectable()
export class ParkingSearchService {
  constructor(
    private readonly lots: ParkingLotsRepository,
    private readonly settings: SettingsService,
  ) {}

  async search(query: SearchQuery): Promise<SearchResponse> {
    const radiusMeters =
      query.radiusMeters ?? (await this.settings.get('search.defaultRadiusMeters'));

    const results = await this.lots.search({
      latitude: query.lat,
      longitude: query.lng,
      radiusMeters,
      shift: query.shift,
      vehicleType: query.vehicleType,
      maxPriceMinor: query.maxPriceMinor,
      amenities: query.amenities ?? [],
      sort: query.sort,
      limit: MAX_SEARCH_RESULTS,
    });

    return {
      results,
      totalLots: results.length,
      totalAvailableSpots: results.reduce((sum, lot) => sum + lot.offer.availableSpots, 0),
      radiusMeters,
    };
  }
}
