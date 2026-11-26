import type {
  Booking,
  BookingStatus,
  PartnerBooking,
  Shift,
  VehicleType,
} from '@parqueavecino/contracts';

export interface BookingRecord extends Booking {
  driverId: string;
  offerId: string;
}

export interface NewBooking {
  driverId: string;
  parkingLotId: string;
  offerId: string;
  shift: Shift;
  vehicleType: VehicleType;
  plate: string;
  priceMinor: number;
  currency: string;
  renewalOfId?: string;
}

export interface BookingActivation {
  accessCode: string;
  startsAt: Date;
  endsAt: Date;
}

export abstract class BookingsRepository {
  abstract create(data: NewBooking): Promise<BookingRecord>;
  abstract findById(id: string): Promise<BookingRecord | null>;
  abstract listByDriver(driverId: string): Promise<BookingRecord[]>;
  /** Renovación pendiente o activa de una mensualidad (como mucho una a la vez). */
  abstract findOpenRenewal(bookingId: string): Promise<BookingRecord | null>;
  /**
   * Cambia de estado solo si la reserva está en uno de `from` (evita carreras entre el webhook,
   * el navegador y el job de vencimientos). Devuelve false si no aplicó.
   */
  abstract transition(
    id: string,
    from: BookingStatus[],
    to: BookingStatus,
    activation?: BookingActivation,
  ): Promise<boolean>;
  /** Pendientes de pago creadas antes de `createdBefore`. */
  abstract findStalePending(createdBefore: Date): Promise<BookingRecord[]>;
  /** Activas cuya vigencia terminó. */
  abstract findEndedActive(now: Date): Promise<BookingRecord[]>;
  abstract countByStatus(partnerId?: string): Promise<Record<BookingStatus, number>>;
  abstract recentForPartner(partnerId: string, limit: number): Promise<PartnerBooking[]>;
}
