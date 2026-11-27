import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  BookingStatus,
  type Booking,
  type BookingCheckout,
  type BookingReceipt,
  type CreateBookingInput,
  type PartnerSummary,
} from '@parqueavecino/contracts';
import { AppConfigService } from '../../../config/app-config.service';
import { ParkingLotsService } from '../../parking-lots/application/parking-lots.service';
import { PaymentsService, type PaymentOutcome } from '../../payments/application/payments.service';
import { SettingsService } from '../../settings/application/settings.service';
import { UsersService } from '../../users/application/users.service';
import { BookingsRepository, type BookingRecord } from '../domain/bookings.repository';

const NOT_FOUND = 'Reserva no encontrada';
/** Sin letras ni números ambiguos (0/O, 1/I) para leerlo en la portería. */
const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACCESS_CODE_LENGTH = 8;
const RECENT_PARTNER_BOOKINGS = 8;

export function generateAccessCode(): string {
  return Array.from(
    { length: ACCESS_CODE_LENGTH },
    () => ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)],
  ).join('');
}

/** Vigencia de una mensualidad: un mes calendario desde el pago. */
export function monthlyPeriod(start: Date): { startsAt: Date; endsAt: Date } {
  const endsAt = new Date(start);
  endsAt.setMonth(endsAt.getMonth() + 1);
  return { startsAt: start, endsAt };
}

function toBooking({ driverId: _d, offerId: _o, ...booking }: BookingRecord): Booking {
  return booking;
}

/** Número legible del recibo: prefijo + inicio del id de la reserva. */
export function receiptNumber(bookingId: string): string {
  return `PV-${bookingId.replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

/**
 * Mensualidades: reserva con cupo apartado → pago → activa. Los cupos se apartan de forma
 * atómica y vuelven si el pago falla, la reserva vence sin pagarse o se cancela.
 */
@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingsService.name);
  private sweepTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly repository: BookingsRepository,
    private readonly lots: ParkingLotsService,
    private readonly payments: PaymentsService,
    private readonly users: UsersService,
    private readonly settings: SettingsService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    const seconds = this.config.get('BOOKINGS_SWEEP_INTERVAL_SECONDS');
    if (seconds === 0) return;
    this.sweepTimer = setInterval(() => void this.sweep(), seconds * 1000);
    this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  async create(driverId: string, input: CreateBookingInput): Promise<BookingCheckout> {
    if (!this.payments.enabled) {
      throw new ServiceUnavailableException('Los pagos no están disponibles en este momento');
    }
    const offer = await this.lots.reserveSpot(input.offerId);
    let booking: BookingRecord | undefined;
    try {
      await this.users.ensureVehicle(driverId, { plate: input.plate, type: offer.vehicleType });
      booking = await this.repository.create({
        driverId,
        parkingLotId: offer.parkingLotId,
        offerId: offer.offerId,
        shift: offer.shift,
        vehicleType: offer.vehicleType,
        plate: input.plate,
        priceMinor: offer.monthlyPriceMinor,
        currency: offer.currency,
      });
      const { clientSecret } = await this.payments.startCharge({
        bookingId: booking.id,
        payeeId: offer.partnerId,
        amountMinor: booking.priceMinor,
        currency: booking.currency,
        description: `Mensualidad ${booking.shift} · ${booking.parkingLot.name} · ${booking.plate}`,
      });
      return { booking: toBooking(booking), clientSecret };
    } catch (error) {
      // Nada quedó cobrado: se devuelve el cupo y se anula la reserva a medio crear.
      if (booking) {
        await this.repository.transition(booking.id, [BookingStatus.PENDING_PAYMENT], 'CANCELLED');
      }
      await this.lots.releaseSpot(offer.offerId);
      throw error;
    }
  }

  /**
   * Renueva una mensualidad activa por otro mes, al precio vigente de la franja. La renovación
   * no aparta un cupo nuevo: hereda el de la mensualidad actual y empieza cuando esta termina.
   * Si ya hay una renovación pendiente de pago, devuelve esa (idempotente).
   */
  async renew(driverId: string, id: string): Promise<BookingCheckout> {
    if (!this.payments.enabled) {
      throw new ServiceUnavailableException('Los pagos no están disponibles en este momento');
    }
    const current = await this.getOwned(driverId, id);
    if (current.status !== BookingStatus.ACTIVE) {
      throw new BadRequestException('Solo puedes renovar una mensualidad activa');
    }
    const open = await this.repository.findOpenRenewal(id);
    if (open?.status === BookingStatus.ACTIVE) {
      throw new ConflictException('Esta mensualidad ya está renovada');
    }
    if (open) return this.checkout(driverId, open.id);

    const offer = await this.lots.getSellableOffer(current.offerId);
    const renewal = await this.repository.create({
      driverId,
      parkingLotId: offer.parkingLotId,
      offerId: offer.offerId,
      shift: offer.shift,
      vehicleType: offer.vehicleType,
      plate: current.plate,
      priceMinor: offer.monthlyPriceMinor,
      currency: offer.currency,
      renewalOfId: current.id,
    });
    try {
      const { clientSecret } = await this.payments.startCharge({
        bookingId: renewal.id,
        payeeId: offer.partnerId,
        amountMinor: renewal.priceMinor,
        currency: renewal.currency,
        description: `Renovación ${renewal.shift} · ${renewal.parkingLot.name} · ${renewal.plate}`,
      });
      return { booking: toBooking(renewal), clientSecret };
    } catch (error) {
      await this.repository.transition(renewal.id, [BookingStatus.PENDING_PAYMENT], 'CANCELLED');
      throw error;
    }
  }

  /** Recibo de una mensualidad pagada (también de una reembolsada, como soporte). */
  async receipt(driverId: string, id: string): Promise<BookingReceipt> {
    const booking = await this.getOwned(driverId, id);
    const payment = await this.payments.paidFor(id);
    if (!payment) throw new NotFoundException('Esta mensualidad aún no tiene recibo');
    const driver = await this.users.getOrThrow(driverId);
    return {
      number: receiptNumber(booking.id),
      booking: toBooking(booking),
      driver: { fullName: driver.fullName, email: driver.email },
      payment: {
        provider: payment.provider,
        reference: payment.providerRef,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        status: payment.status,
        paidAt: payment.paidAt?.toISOString() ?? null,
      },
      issuedAt: new Date().toISOString(),
    };
  }

  async listForDriver(driverId: string): Promise<Booking[]> {
    return (await this.repository.listByDriver(driverId)).map(toBooking);
  }

  /** Estado del checkout: sincroniza con la pasarela y devuelve el secreto si sigue pendiente. */
  async checkout(driverId: string, id: string): Promise<BookingCheckout> {
    let booking = await this.getOwned(driverId, id);
    if (booking.status === BookingStatus.PENDING_PAYMENT) {
      const outcome = await this.payments.sync(id);
      if (outcome && outcome !== 'pending') {
        await this.apply(booking, outcome);
        booking = await this.getOwned(driverId, id);
      }
    }
    const clientSecret =
      booking.status === BookingStatus.PENDING_PAYMENT
        ? await this.payments.clientSecretFor(id)
        : null;
    return { booking: toBooking(booking), clientSecret };
  }

  /**
   * Pendiente → se anula y se libera el cupo. Activa → reembolso si aún está dentro de la
   * ventana de cancelación gratuita (`booking.freeCancellationHours` desde el pago).
   */
  async cancel(driverId: string, id: string): Promise<Booking> {
    const booking = await this.getOwned(driverId, id);
    if (booking.status === BookingStatus.PENDING_PAYMENT) {
      await this.payments.cancelPending(id);
      await this.release(booking, BookingStatus.CANCELLED);
    } else if (booking.status === BookingStatus.ACTIVE) {
      const hours = await this.settings.get('booking.freeCancellationHours');
      const startsAt = booking.startsAt ? new Date(booking.startsAt).getTime() : 0;
      if (Date.now() > startsAt + hours * 3_600_000) {
        throw new BadRequestException(
          `La cancelación gratuita solo aplica durante las primeras ${hours} horas`,
        );
      }
      await this.payments.refund(id);
      await this.release(booking, BookingStatus.REFUNDED, [BookingStatus.ACTIVE]);
    } else {
      throw new BadRequestException('Esta mensualidad ya no se puede cancelar');
    }
    return toBooking(await this.getOwned(driverId, id));
  }

  /** Webhook firmado de la pasarela. */
  async handlePaymentWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const result = await this.payments.handleWebhook(rawBody, signature);
    if (!result) return;
    const booking = await this.repository.findById(result.bookingId);
    if (booking) await this.apply(booking, result.outcome);
  }

  countByStatus(partnerId?: string): Promise<Record<BookingStatus, number>> {
    return this.repository.countByStatus(partnerId);
  }

  async partnerSummary(partnerId: string): Promise<PartnerSummary> {
    const [spots, counts, revenue, recentBookings] = await Promise.all([
      this.lots.spotTotals(partnerId),
      this.repository.countByStatus(partnerId),
      this.payments.revenue(partnerId),
      this.repository.recentForPartner(partnerId, RECENT_PARTNER_BOOKINGS),
    ]);
    return {
      lots: spots.lots,
      totalSpots: spots.totalSpots,
      availableSpots: spots.availableSpots,
      bookings: { active: counts.ACTIVE, pending: counts.PENDING_PAYMENT },
      revenue: { ...revenue, netMinor: revenue.grossMinor - revenue.commissionMinor },
      recentBookings,
    };
  }

  /** Libera cupos de reservas sin pagar y vence mensualidades terminadas. */
  async sweep(now = new Date()): Promise<void> {
    try {
      const holdMinutes = await this.settings.get('booking.paymentHoldMinutes');
      const stale = await this.repository.findStalePending(
        new Date(now.getTime() - holdMinutes * 60_000),
      );
      for (const booking of stale) {
        // Último intento: quizá se pagó y el webhook no llegó.
        const outcome = await this.payments.sync(booking.id);
        if (outcome === 'succeeded') {
          await this.apply(booking, outcome);
          continue;
        }
        await this.payments.cancelPending(booking.id);
        await this.release(booking, BookingStatus.EXPIRED);
      }
      for (const booking of await this.repository.findEndedActive(now)) {
        await this.release(booking, BookingStatus.EXPIRED, [BookingStatus.ACTIVE]);
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Falló el barrido de reservas');
    }
  }

  private async apply(booking: BookingRecord, outcome: PaymentOutcome): Promise<void> {
    switch (outcome) {
      case 'succeeded': {
        const previous = booking.renewalOfId
          ? await this.repository.findById(booking.renewalOfId)
          : null;
        // Una renovación empieza cuando termina la anterior (o ya, si esa venció).
        const previousEnd = previous?.endsAt ? new Date(previous.endsAt) : null;
        const now = new Date();
        const start = previousEnd && previousEnd > now ? previousEnd : now;
        const activated = await this.repository.transition(
          booking.id,
          // Si el pago llega tarde (la reserva ya venció), igual se honra: el cupo se re-aparta.
          [BookingStatus.PENDING_PAYMENT, BookingStatus.EXPIRED, BookingStatus.CANCELLED],
          BookingStatus.ACTIVE,
          { accessCode: generateAccessCode(), ...monthlyPeriod(start) },
        );
        const hadSpot = booking.renewalOfId
          ? previous?.status === BookingStatus.ACTIVE // hereda el cupo de la anterior
          : booking.status === BookingStatus.PENDING_PAYMENT;
        if (activated && !hadSpot) {
          await this.lots.reserveSpot(booking.offerId).catch(() => undefined);
        }
        return;
      }
      case 'failed':
        // Un rechazo de tarjeta no anula la reserva: el conductor puede reintentar hasta que venza.
        return;
      case 'refunded':
        await this.release(booking, BookingStatus.REFUNDED, [BookingStatus.ACTIVE]);
        return;
      case 'pending':
        return;
    }
  }

  private async release(
    booking: BookingRecord,
    to: BookingStatus,
    from: BookingStatus[] = [BookingStatus.PENDING_PAYMENT],
  ): Promise<void> {
    const holdsSpot = await this.holdsSpot(booking);
    if (!(await this.repository.transition(booking.id, from, to))) return;
    // Si la siguiente mensualidad ya está pagada, el cupo pasa a ella en lugar de liberarse.
    const renewal = await this.repository.findOpenRenewal(booking.id);
    if (holdsSpot && renewal?.status !== BookingStatus.ACTIVE) {
      await this.lots.releaseSpot(booking.offerId);
    }
  }

  /**
   * ¿Esta reserva ocupa un cupo? Las nuevas lo apartan al crearse; una renovación no lo
   * aparta: lo recibe cuando la mensualidad anterior deja de estar activa.
   */
  private async holdsSpot(booking: BookingRecord): Promise<boolean> {
    if (!booking.renewalOfId) {
      return (
        booking.status === BookingStatus.PENDING_PAYMENT || booking.status === BookingStatus.ACTIVE
      );
    }
    if (booking.status !== BookingStatus.ACTIVE) return false;
    const previous = await this.repository.findById(booking.renewalOfId);
    return previous?.status !== BookingStatus.ACTIVE;
  }

  /** Reserva del conductor; 404 (no 403) si es de otro, para no revelar que existe. */
  private async getOwned(driverId: string, id: string): Promise<BookingRecord> {
    const booking = await this.repository.findById(id);
    if (!booking || booking.driverId !== driverId) throw new NotFoundException(NOT_FOUND);
    return booking;
  }
}
