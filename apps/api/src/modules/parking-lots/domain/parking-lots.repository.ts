import type {
  Amenity,
  OfferInput,
  ParkingLot,
  ParkingLotInput,
  ParkingLotStatus,
  ParkingLotUpdate,
  SearchResult,
  SearchSort,
  Shift,
  VehicleType,
} from '@parqueavecino/contracts';

/** Parqueadero con el dueño, para validar permisos. */
export type ParkingLotRecord = ParkingLot & { partnerId: string };

/** Criterios ya resueltos (radio por defecto aplicado) para la búsqueda geoespacial. */
export interface LotSearchCriteria {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  shift: Shift;
  vehicleType: VehicleType;
  maxPriceMinor?: number;
  amenities: Amenity[];
  sort: SearchSort;
  limit: number;
}

export abstract class ParkingLotsRepository {
  /** Parqueaderos activos dentro del radio con cupo de esa franja y vehículo (incluye llenos). */
  abstract search(criteria: LotSearchCriteria): Promise<SearchResult[]>;
  abstract create(
    partnerId: string,
    input: ParkingLotInput,
    status: ParkingLotStatus,
  ): Promise<ParkingLotRecord>;
  abstract findById(id: string): Promise<ParkingLotRecord | null>;
  abstract listByPartner(partnerId: string): Promise<ParkingLotRecord[]>;
  abstract update(id: string, input: ParkingLotUpdate): Promise<ParkingLotRecord>;
  /** Crea o actualiza los cupos por (franja, tipo de vehículo) en una sola transacción. */
  abstract upsertOffers(
    parkingLotId: string,
    offers: OfferInput[],
    currency: string,
  ): Promise<ParkingLotRecord>;
}
