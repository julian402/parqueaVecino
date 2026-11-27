import { BookingStatus, type BookingStatus as Status } from '@parqueavecino/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../../../config/app-config.service';
import type { NotificationsService } from '../../notifications/application/notifications.service';
import type { ParkingLotsService } from '../../parking-lots/application/parking-lots.service';
import { commissionFor, type PaymentsService } from '../../payments/application/payments.service';
import type { SettingsService } from '../../settings/application/settings.service';
import type { UsersService } from '../../users/application/users.service';
import {
  BookingsRepository,
  type BookingActivation,
  type BookingRecord,
  type ExpiringBooking,
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
  noticesSent = new Map<string, Date>();
  findExpiringWithoutNotice(now: Date, until: Date): Promise<ExpiringBooking[]> {
    return Promise.resolve(
      this.rows
        .filter((r) => {
          if (r.status !== BookingStatus.ACTIVE || !r.endsAt || this.noticesSent.has(r.id)) {
            return false;
          }
          const ends = new Date(r.endsAt);
          const renewed = this.rows.some(
            (x) => x.renewalOfId === r.id && x.status === BookingStatus.ACTIVE,
          );
          return ends >= now && ends <= until && !renewed;
        })
        .map((r) => ({
          id: r.id,
          plate: r.plate,
          endsAt: new Date(r.endsAt ?? 0),
          parkingLotName: r.parkingLot.name,
          driver: { email: 'conductor@test.co', fullName: 'Ana Pérez' },
        })),
    );
  }
  markExpiryNoticeSent(id: string, at: Date) {
    this.noticesSent.set(id, at);
    return Promise.resolve();
  }
  occupancyIntervals() {
    return Promise.resolve([]);
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
  let notifications: { bookingExpiring: Fn };

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
    const settingValues: Record<string, number> = {
      'booking.paymentHoldMinutes': 30,
      'booking.expiryNoticeDays': 3,
    };
    const settings = {
      get: vi.fn((key: string) => Promise.resolve(settingValues[key] ?? 24)),
    };
    notifications = { bookingExpiring: vi.fn().mockResolvedValue(true) };
    service = new BookingsService(
      repo,
      lots as unknown as ParkingLotsService,
      payments as unknown as PaymentsService,
      { ensureVehicle: vi.fn() } as unknown as UsersService,
      settings as unknown as SettingsService,
      notifications as unknown as NotificationsService,
      { register: vi.fn() },
      { get: () => 0 } as unknown as AppConfigService,
    );
  });

  it('rechaza una placa que no es del tipo de vehículo del cupo y devuelve el cupo', async () => {
    await expect(service.create('d1', { offerId: 'o1', plate: 'ABC12D' })).rejects.toThrow(
      /Placa de carro/,
    );
    expect(lots.releaseSpot).toHaveBeenCalledWith('o1');
    expect(repo.rows).toHaveLength(0);
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

  it('avisa una sola vez las mensualidades por terminar sin renovación pagada', async () => {
    const now = new Date('2026-05-10T12:00:00Z');
    const soon = {
      startsAt: new Date('2026-04-12T12:00:00Z'),
      endsAt: new Date('2026-05-12T12:00:00Z'),
    };
    const later = {
      startsAt: new Date('2026-05-01T12:00:00Z'),
      endsAt: new Date('2026-06-01T12:00:00Z'),
    };
    for (const period of [soon, later]) {
      await service.create('d1', { offerId: 'o1', plate: 'ABC123' });
      const row = repo.rows.at(-1);
      if (!row) throw new Error('sin reserva');
      await repo.transition(row.id, [BookingStatus.PENDING_PAYMENT], BookingStatus.ACTIVE, {
        accessCode: 'X',
        ...period,
      });
    }

    await service.notifyExpiring(now);
    await service.notifyExpiring(now);

    expect(notifications.bookingExpiring).toHaveBeenCalledTimes(1);
    expect(notifications.bookingExpiring).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'conductor@test.co' }),
      expect.objectContaining({ plate: 'ABC123', endsAt: soon.endsAt }),
    );
    expect([...repo.noticesSent.keys()]).toEqual(['b1']);
  });

  it('si el correo falla, el aviso queda pendiente para el siguiente intento', async () => {
    notifications.bookingExpiring.mockResolvedValue(false);
    await service.create('d1', { offerId: 'o1', plate: 'ABC123' });
    await repo.transition('b1', [BookingStatus.PENDING_PAYMENT], BookingStatus.ACTIVE, {
      accessCode: 'X',
      startsAt: new Date('2026-04-12T12:00:00Z'),
      endsAt: new Date('2026-05-12T12:00:00Z'),
    });
    await service.notifyExpiring(new Date('2026-05-11T12:00:00Z'));
    expect(repo.noticesSent.size).toBe(0);
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
