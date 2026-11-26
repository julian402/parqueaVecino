import { Injectable } from '@nestjs/common';
import {
  PaymentStatus,
  type AdminPaymentListQuery,
  type AdminPaymentPage,
  type RevenueSummary,
} from '@parqueavecino/contracts';
import { AppConfigService } from '../../../config/app-config.service';
import { SettingsService } from '../../settings/application/settings.service';
import { PaymentProvider, type PaymentEvent } from '../domain/payment-provider';
import { PaymentsRepository, type PaymentRecord } from '../domain/payments.repository';

/** Días de la serie de ingresos en los paneles. */
const REVENUE_DAYS = 14;

export interface ChargeRequest {
  bookingId: string;
  amountMinor: number;
  currency: string;
  description: string;
}

/** Resultado de un pago visto desde la reserva. */
export type PaymentOutcome = 'succeeded' | 'failed' | 'refunded' | 'pending';

export function commissionFor(amountMinor: number, basisPoints: number): number {
  return Math.round((amountMinor * basisPoints) / 10_000);
}

const OUTCOME_BY_EVENT: Record<PaymentEvent['type'], PaymentOutcome> = {
  'payment.succeeded': 'succeeded',
  'payment.failed': 'failed',
  'payment.refunded': 'refunded',
};

const STATUS_BY_OUTCOME: Record<Exclude<PaymentOutcome, 'pending'>, PaymentStatus> = {
  succeeded: PaymentStatus.SUCCEEDED,
  failed: PaymentStatus.FAILED,
  refunded: PaymentStatus.REFUNDED,
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly provider: PaymentProvider,
    private readonly repository: PaymentsRepository,
    private readonly settings: SettingsService,
    private readonly config: AppConfigService,
  ) {}

  get enabled(): boolean {
    return this.provider.enabled;
  }

  /** Crea el cobro en la pasarela con la comisión vigente y lo registra en el libro. */
  async startCharge(request: ChargeRequest): Promise<{ clientSecret: string | null }> {
    const basisPoints = await this.settings.get('commission.basisPoints');
    const commissionMinor = commissionFor(request.amountMinor, basisPoints);
    const payment = await this.provider.createPayment({
      amountMinor: request.amountMinor,
      currency: request.currency,
      commissionMinor,
      description: request.description,
      // Una reserva = un cobro: repetir la petición no crea un segundo PaymentIntent.
      idempotencyKey: `booking-${request.bookingId}`,
      metadata: { bookingId: request.bookingId },
    });
    await this.repository.create({
      bookingId: request.bookingId,
      provider: this.provider.name,
      providerRef: payment.id,
      amountMinor: request.amountMinor,
      commissionMinor,
      currency: request.currency,
    });
    return { clientSecret: payment.clientSecret };
  }

  /** Secreto para retomar el checkout de una reserva pendiente. */
  async clientSecretFor(bookingId: string): Promise<string | null> {
    const payment = await this.repository.findLatestForBooking(bookingId);
    if (!payment || payment.status !== PaymentStatus.PENDING) return null;
    return (await this.provider.getPayment(payment.providerRef)).clientSecret;
  }

  /**
   * Consulta el estado real en la pasarela. Respaldo del webhook: en local sin `stripe listen`
   * la reserva igual se confirma cuando el navegador vuelve del pago.
   */
  async sync(bookingId: string): Promise<PaymentOutcome | null> {
    const payment = await this.repository.findLatestForBooking(bookingId);
    if (!payment) return null;
    if (payment.status !== PaymentStatus.PENDING) return outcomeOf(payment.status);
    const remote = await this.provider.getPayment(payment.providerRef);
    if (remote.status === 'pending') return 'pending';
    const outcome: PaymentOutcome = remote.status === 'succeeded' ? 'succeeded' : 'failed';
    await this.record(payment, outcome);
    return outcome;
  }

  /** Webhook firmado → actualiza el libro y devuelve a qué reserva afecta. */
  async handleWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ bookingId: string; outcome: PaymentOutcome } | null> {
    const event = this.provider.parseWebhook(rawBody, signature);
    if (!event) return null;
    const payment = await this.repository.findByProviderRef(event.paymentId);
    if (!payment) return null;
    const outcome = OUTCOME_BY_EVENT[event.type];
    await this.record(payment, outcome);
    return { bookingId: payment.bookingId, outcome };
  }

  /** Cancela el cobro pendiente (la reserva venció o el conductor desistió). */
  async cancelPending(bookingId: string): Promise<void> {
    const payment = await this.repository.findLatestForBooking(bookingId);
    if (payment?.status !== PaymentStatus.PENDING) return;
    await this.provider.cancelPayment(payment.providerRef);
    await this.repository.setStatus(payment.id, PaymentStatus.FAILED);
  }

  async refund(bookingId: string): Promise<void> {
    const payment = await this.repository.findLatestForBooking(bookingId);
    if (payment?.status !== PaymentStatus.SUCCEEDED) return;
    await this.provider.refundPayment(payment.providerRef, `refund-${payment.id}`);
    await this.repository.setStatus(payment.id, PaymentStatus.REFUNDED);
  }

  /** Pago que respalda el recibo: el último cobrado (o reembolsado después). */
  async paidFor(bookingId: string): Promise<PaymentRecord | null> {
    const payment = await this.repository.findLatestForBooking(bookingId);
    return payment &&
      (payment.status === PaymentStatus.SUCCEEDED || payment.status === PaymentStatus.REFUNDED)
      ? payment
      : null;
  }

  async listForAdmin(query: AdminPaymentListQuery): Promise<AdminPaymentPage> {
    const { items, total } = await this.repository.listForAdmin(query);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  revenue(partnerId?: string): Promise<RevenueSummary> {
    return this.repository.revenue({
      currency: this.config.get('APP_CURRENCY'),
      timezone: this.config.get('APP_TIMEZONE'),
      days: REVENUE_DAYS,
      partnerId,
    });
  }

  private async record(payment: PaymentRecord, outcome: PaymentOutcome): Promise<void> {
    if (outcome === 'pending') return;
    const status = STATUS_BY_OUTCOME[outcome];
    if (payment.status === status) return; // Webhooks repetidos: idempotente.
    await this.repository.setStatus(
      payment.id,
      status,
      outcome === 'succeeded' ? new Date() : undefined,
    );
  }
}

function outcomeOf(status: PaymentStatus): PaymentOutcome {
  switch (status) {
    case PaymentStatus.SUCCEEDED:
      return 'succeeded';
    case PaymentStatus.REFUNDED:
      return 'refunded';
    case PaymentStatus.FAILED:
      return 'failed';
    default:
      return 'pending';
  }
}
