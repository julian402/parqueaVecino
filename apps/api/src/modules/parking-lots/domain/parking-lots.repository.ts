import type {
  AdminParkingLot,
  AdminParkingLotListQuery,
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

/** Datos del cupo que se copian a la reserva. */
export interface ReservedOffer {
  offerId: string;
  parkingLotId: string;
  /** Dueño del parqueadero: a su cuenta conectada va el pago (menos la comisión). */
  partnerId: string;
  shift: Shift;
  vehicleType: VehicleType;
  monthlyPriceMinor: number;
  currency: string;
}

export interface SpotTotals {
  lots: number;
  totalSpots: number;
  availableSpots: number;
}

/** Oferta lista para guardar, con los cupos libres ya calculados. */
export type OfferWrite = OfferInput & { availableSpots: number };

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
    offers: OfferWrite[],
    currency: string,
  ): Promise<ParkingLotRecord>;
  abstract listForAdmin(
    query: AdminParkingLotListQuery,
  ): Promise<{ items: AdminParkingLot[]; total: number }>;
  abstract findForAdmin(id: string): Promise<AdminParkingLot | null>;
  abstract setStatus(id: string, status: ParkingLotStatus, verifiedAt?: Date | null): Promise<void>;
  /** Quita el sello "Verificado" sin cambiar el estado (p. ej. venció la póliza). */
  abstract clearVerification(id: string): Promise<void>;
  abstract countByStatus(): Promise<Record<ParkingLotStatus, number>>;
  /** Cupos publicados (ofertas activas) por franja, de un aliado o de uno de sus parqueaderos. */
  abstract capacityByShift(
    partnerId: string,
    parkingLotId?: string,
  ): Promise<Record<Shift, number>>;
  /** Cupos publicados y libres (de un aliado, o de toda la plataforma). */
  abstract spotTotals(partnerId?: string): Promise<SpotTotals>;
  /**
   * Descuenta un cupo libre de forma atómica (sin sobreventa). Devuelve null si el cupo no
   * existe, está inactivo, el parqueadero no está publicado o ya no quedan cupos.
   */
  abstract reserveSpot(offerId: string): Promise<ReservedOffer | null>;
  /** Oferta con su precio vigente; `available` = activa y en un parqueadero publicado. */
  abstract findOffer(offerId: string): Promise<(ReservedOffer & { available: boolean }) | null>;
  /** Devuelve un cupo (pago fallido, reserva vencida o cancelada). */
  abstract releaseSpot(offerId: string): Promise<void>;
}
