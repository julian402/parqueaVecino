import { BookingStatus, type BookingStatus as Status } from '@parqueavecino/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../../../config/app-config.service';
import type { ParkingLotsService } from '../../parking-lots/application/parking-lots.service';
import { commissionFor, type PaymentsService } from '../../payments/application/payments.service';
import type { SettingsService } from '../../settings/application/settings.service';
import type { UsersService } from '../../users/application/users.service';
import {
  BookingsRepository,
  type BookingActivation,
  type BookingRecord,
  type NewBooking,
} from '../domain/bookings.repository';
import { BookingsService, generateAccessCode, monthlyPeriod } from './bookings.service';

class MemoryBookings extends BookingsRepository {
  rows: BookingRecord[] = [];
  create(data: NewBooking) {
    const row: BookingRecord = {
      ...data,
      renewalOfId: data.renewalOfId ?? null,
      id: `b${this.rows.length + 1}`,
      status: BookingStatus.PENDING_PAYMENT,
      accessCode: null,
      startsAt: null,
      endsAt: null,
      createdAt: new Date().toISOString(),
      parkingLot: { id: data.parkingLotId, name: 'Lote', address: 'Cra 13' },
    };
    this.rows.push(row);
    return Promise.resolve(row);
  }
  findById(id: string) {
    return Promise.resolve(this.rows.find((row) => row.id === id) ?? null);
  }
  findOpenRenewal(bookingId: string) {
    return Promise.resolve(
      this.rows.find(
        (r) =>
          r.renewalOfId === bookingId &&
          (r.status === BookingStatus.PENDING_PAYMENT || r.status === BookingStatus.ACTIVE),
      ) ?? null,
    );
  }
  listByDriver(driverId: string) {
    return Promise.resolve(this.rows.filter((row) => row.driverId === driverId));
  }
  transition(id: string, from: Status[], to: Status, activation?: BookingActivation) {
    const row = this.rows.find((r) => r.id === id);
    if (!row || !from.includes(row.status)) return Promise.resolve(false);
    row.status = to;
    if (activation) {
      row.accessCode = activation.accessCode;
      row.startsAt = activation.startsAt.toISOString();
      row.endsAt = activation.endsAt.toISOString();
    }
    return Promise.resolve(true);
  }
  findStalePending(createdBefore: Date) {
    return Promise.resolve(
      this.rows.filter(
        (r) => r.status === BookingStatus.PENDING_PAYMENT && new Date(r.createdAt) < createdBefore,
      ),
    );
  }
  findEndedActive(now: Date) {
    return Promise.resolve(
      this.rows.filter(
        (r) => r.status === BookingStatus.ACTIVE && r.endsAt && new Date(r.endsAt) < now,
      ),
    );
  }
  countByStatus() {
    return Promise.resolve({} as Record<Status, number>);
  }
  recentForPartner() {
    return Promise.resolve([]);
  }
}

const offer = {
  offerId: 'o1',
  parkingLotId: 'l1',
  partnerId: 'p1',
  shift: 'NIGHT' as const,
  vehicleType: 'CAR' as const,
  monthlyPriceMinor: 18_000_000,
  currency: 'COP',
};

describe('BookingsService', () => {
  let repo: MemoryBookings;
  let lots: {
    reserveSpot: ReturnType<typeof vi.fn>;
    releaseSpot: ReturnType<typeof vi.fn>;
    getSellableOffer: ReturnType<typeof vi.fn>;
  };
  type Fn = ReturnType<typeof vi.fn>;
  let payments: {
    enabled: boolean;
    startCharge: Fn;
    sync: Fn;
    clientSecretFor: Fn;
    cancelPending: Fn;
    refund: Fn;
  };
  let service: BookingsService;

  beforeEach(() => {
    repo = new MemoryBookings();
    lots = {
      reserveSpot: vi.fn().mockResolvedValue(offer),
      releaseSpot: vi.fn(),
      getSellableOffer: vi.fn().mockResolvedValue({ ...offer, monthlyPriceMinor: 19_000_000 }),
    };
    payments = {
      enabled: true,
      startCharge: vi.fn().mockResolvedValue({ clientSecret: 'pi_secret' }),
      sync: vi.fn().mockResolvedValue('pending'),
      clientSecretFor: vi.fn().mockResolvedValue('pi_secret'),
      cancelPending: vi.fn(),
      refund: vi.fn(),
    };
    const settings = {
      get: vi.fn((key: string) => Promise.resolve(key === 'booking.paymentHoldMinutes' ? 30 : 24)),
    };
    service = new BookingsService(
      repo,
      lots as unknown as ParkingLotsService,
      payments as unknown as PaymentsService,
      { ensureVehicle: vi.fn() } as unknown as UsersService,
      settings as unknown as SettingsService,
      { get: () => 0 } as unknown as AppConfigService,
    );
  });

  it('aparta el cupo, crea la reserva pendiente y devuelve el secreto de pago', async () => {
    const checkout = await service.create('d1', { offerId: 'o1', plate: 'ABC123' });
    expect(lots.reserveSpot).toHaveBeenCalledWith('o1');
    expect(checkout.booking.status).toBe(BookingStatus.PENDING_PAYMENT);
    expect(checkout.booking.priceMinor).toBe(offer.monthlyPriceMinor);
    expect(checkout.clientSecret).toBe('pi_secret');
  });

  it('devuelve el cupo si la pasarela falla al crear el cobro', async () => {
    payments.startCharge.mockRejectedValue(new Error('stripe caído'));
    await expect(service.create('d1', { offerId: 'o1', plate: 'ABC123' })).rejects.toThrow();
    expect(lots.releaseSpot).toHaveBeenCalledWith('o1');
    expect(repo.rows[0]?.status).toBe(BookingStatus.CANCELLED);
  });

  it('activa la reserva con código de ingreso cuando el pago se confirma', async () => {
    const { booking } = await service.create('d1', { offerId: 'o1', plate: 'ABC123' });
    payments.sync.mockResolvedValue('succeeded');
    const result = await service.checkout('d1', booking.id);
    expect(result.booking.status).toBe(BookingStatus.ACTIVE);
    expect(result.booking.accessCode).toMatch(/^[A-Z2-9]{8}$/);
    expect(result.clientSecret).toBeNull();
  });

  it('no deja ver la reserva de otro conductor (404)', async () => {
    const { booking } = await service.create('d1', { offerId: 'o1', plate: 'ABC123' });
    await expect(service.checkout('otro', booking.id)).rejects.toThrow('Reserva no encontrada');
  });

  it('libera el cupo de reservas sin pagar al vencer la retención', async () => {
    const { booking } = await service.create('d1', { offerId: 'o1', plate: 'ABC123' });
    await service.sweep(new Date(Date.now() + 31 * 60_000));
    expect(repo.rows.find((r) => r.id === booking.id)?.status).toBe(BookingStatus.EXPIRED);
    expect(payments.cancelPending).toHaveBeenCalledWith(booking.id);
    expect(lots.releaseSpot).toHaveBeenCalledWith('o1');
  });

  it('cancela con reembolso dentro de la ventana gratuita', async () => {
    const { booking } = await service.create('d1', { offerId: 'o1', plate: 'ABC123' });
    payments.sync.mockResolvedValue('succeeded');
    await service.checkout('d1', booking.id);
    const cancelled = await service.cancel('d1', booking.id);
    expect(payments.refund).toHaveBeenCalledWith(booking.id);
    expect(cancelled.status).toBe(BookingStatus.REFUNDED);
  });

  async function activeBooking() {
    const { booking } = await service.create('d1', { offerId: 'o1', plate: 'ABC123' });
    payments.sync.mockResolvedValue('succeeded');
    await service.checkout('d1', booking.id);
    payments.sync.mockResolvedValue('pending');
    lots.reserveSpot.mockClear();
    return repo.rows.find((r) => r.id === booking.id)!;
  }

  it('renueva al precio vigente, sin apartar otro cupo, y empieza al terminar la actual', async () => {
    const current = await activeBooking();
    const { booking: renewal } = await service.renew('d1', current.id);
    expect(renewal.renewalOfId).toBe(current.id);
    expect(renewal.priceMinor).toBe(19_000_000);
    expect(lots.reserveSpot).not.toHaveBeenCalled();

    // Pedir renovar otra vez devuelve la misma pendiente.
    const again = await service.renew('d1', current.id);
    expect(again.booking.id).toBe(renewal.id);

    payments.sync.mockResolvedValue('succeeded');
    const paid = await service.checkout('d1', renewal.id);
    expect(paid.booking.status).toBe(BookingStatus.ACTIVE);
    expect(paid.booking.startsAt).toBe(current.endsAt);
    expect(lots.reserveSpot).not.toHaveBeenCalled();
    await expect(service.renew('d1', current.id)).rejects.toThrow('ya está renovada');
  });

  it('al vencer la mensualidad renovada el cupo pasa a la renovación (no se libera)', async () => {
    const current = await activeBooking();
    const { booking: renewal } = await service.renew('d1', current.id);
    payments.sync.mockResolvedValue('succeeded');
    await service.checkout('d1', renewal.id);
    lots.releaseSpot.mockClear();
    await service.sweep(new Date(new Date(current.endsAt!).getTime() + 1000));
    expect(repo.rows.find((r) => r.id === current.id)?.status).toBe(BookingStatus.EXPIRED);
    expect(lots.releaseSpot).not.toHaveBeenCalled();
  });

  it('una renovación sin pagar vence sin liberar un cupo que no apartó', async () => {
    const current = await activeBooking();
    await service.renew('d1', current.id);
    lots.releaseSpot.mockClear();
    payments.sync.mockResolvedValue('pending');
    await service.sweep(new Date(Date.now() + 31 * 60_000));
    expect(lots.releaseSpot).not.toHaveBeenCalled();
  });

  it('solo renueva mensualidades activas', async () => {
    const { booking } = await service.create('d1', { offerId: 'o1', plate: 'ABC123' });
    await expect(service.renew('d1', booking.id)).rejects.toThrow('activa');
  });
});

describe('reglas puras', () => {
  it('calcula la comisión en puntos básicos', () => {
    expect(commissionFor(18_000_000, 1000)).toBe(1_800_000);
    expect(commissionFor(999, 1000)).toBe(100);
  });

  it('la vigencia es de un mes calendario', () => {
    const { endsAt } = monthlyPeriod(new Date('2026-01-15T10:00:00Z'));
    expect(endsAt.toISOString()).toBe('2026-02-15T10:00:00.000Z');
  });

  it('genera códigos de ingreso sin caracteres ambiguos', () => {
    expect(generateAccessCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});
