import type {
  OfferInput,
  ParkingLot,
  ParkingLotInput,
  ParkingLotStatus,
  ParkingLotUpdate,
} from '@parqueavecino/contracts';

/** Parqueadero con el dueño, para validar permisos. */
export type ParkingLotRecord = ParkingLot & { partnerId: string };

export abstract class ParkingLotsRepository {
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
