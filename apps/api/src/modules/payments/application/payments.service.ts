import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  PaymentStatus,
  PayoutAccountStatus,
  type AdminPaymentListQuery,
  type AdminPaymentPage,
  type PayoutAccount,
  type ProviderLink,
  type RevenueSummary,
} from '@parqueavecino/contracts';
import { AppConfigService } from '../../../config/app-config.service';
import { SettingsService } from '../../settings/application/settings.service';
import {
  PaymentProvider,
  type PaymentEvent,
  type ProviderPayoutStatus,
} from '../domain/payment-provider';
import { PaymentsRepository, type PaymentRecord } from '../domain/payments.repository';
import {
  PayoutAccountsRepository,
  type PayoutAccountRecord,
} from '../domain/payout-accounts.repository';

/** Días de la serie de ingresos en los paneles. */
const REVENUE_DAYS = 14;

export interface ChargeRequest {
  bookingId: string;
  /** Aliado dueño del parqueadero: si su cuenta conectada está activa, el pago va a ella. */
  payeeId: string;
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
  // Un rechazo no cierra el cobro: el libro sigue pendiente y el checkout puede reintentar.
  'payment.declined': 'pending',
  'payment.failed': 'failed',
  'payment.refunded': 'refunded',
};

const PAYOUT_STATUS: Record<ProviderPayoutStatus, PayoutAccountStatus> = {
  active: PayoutAccountStatus.ACTIVE,
  pending: PayoutAccountStatus.PENDING,
  action_required: PayoutAccountStatus.ACTION_REQUIRED,
};

/** Ruta de la web a la que vuelve el aliado desde el onboarding de la pasarela. */
const PARTNER_PAYOUTS_PATH = '/aliados/pagos';

/** Aliado que conecta su cuenta (datos para prellenar el onboarding). */
export interface Payee {
  id: string;
  email: string;
  fullName: string;
}

const STATUS_BY_OUTCOME: Record<Exclude<PaymentOutcome, 'pending'>, PaymentStatus> = {
  succeeded: PaymentStatus.SUCCEEDED,
  failed: PaymentStatus.FAILED,
  refunded: PaymentStatus.REFUNDED,
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly provider: PaymentProvider,
    private readonly repository: PaymentsRepository,
    private readonly payoutAccounts: PayoutAccountsRepository,
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
    const destinationRef = await this.activeDestination(request.payeeId);
    const payment = await this.provider.createPayment({
      amountMinor: request.amountMinor,
      currency: request.currency,
      commissionMinor,
      destinationAccountId: destinationRef ?? undefined,
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
      destinationRef,
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
    await this.provider.refundPayment(payment.providerRef, `refund-${payment.id}`, {
      reverseTransfer: payment.destinationRef !== null,
    });
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

  /** Cuenta de pagos del aliado, con el estado actualizado desde la pasarela. */
  async payoutAccount(userId: string): Promise<PayoutAccount> {
    if (!this.provider.enabled) return { paymentsEnabled: false, status: null };
    const account = await this.payoutAccounts.findByUser(userId);
    return { paymentsEnabled: true, status: account ? await this.refreshStatus(account) : null };
  }

  /**
   * Enlace al onboarding de la pasarela (Stripe Connect). Crea la cuenta conectada la primera
   * vez; las siguientes reutiliza la misma para continuar donde quedó.
   */
  async startOnboarding(payee: Payee): Promise<ProviderLink> {
    const page = new URL(PARTNER_PAYOUTS_PATH, this.webUrl()).href;
    const account =
      (await this.payoutAccounts.findByUser(payee.id)) ??
      (await this.payoutAccounts.create({
        userId: payee.id,
        provider: this.provider.name,
        providerRef: await this.provider.createPayoutAccount({
          email: payee.email,
          displayName: payee.fullName,
          idempotencyKey: `payout-account-${payee.id}`,
          metadata: { userId: payee.id },
        }),
      }));
    const url = await this.provider.createOnboardingLink(account.providerRef, {
      returnUrl: `${page}?onboarding=return`,
      refreshUrl: `${page}?onboarding=refresh`,
    });
    return { url };
  }

  /** Panel de la cuenta conectada (pagos recibidos y transferencias al banco). */
  async dashboardLink(userId: string): Promise<ProviderLink> {
    const account = await this.payoutAccounts.findByUser(userId);
    if (!account) throw new NotFoundException('Aún no conectas tu cuenta de pagos');
    return { url: await this.provider.createDashboardLink(account.providerRef) };
  }

  /**
   * Cuenta a la que se envía un cobro. Se vuelve a consultar en la pasarela antes de cobrar
   * (los requisitos cambian); si no está activa o la consulta falla, cobra la plataforma.
   */
  private async activeDestination(payeeId: string): Promise<string | null> {
    const account = await this.payoutAccounts.findByUser(payeeId);
    if (!account) return null;
    try {
      const status = await this.refreshStatus(account);
      return status === PayoutAccountStatus.ACTIVE ? account.providerRef : null;
    } catch (error) {
      this.logger.warn({ err: error, payeeId }, 'No se pudo consultar la cuenta conectada');
      return null;
    }
  }

  private async refreshStatus(account: PayoutAccountRecord): Promise<PayoutAccountStatus> {
    const status = PAYOUT_STATUS[await this.provider.getPayoutStatus(account.providerRef)];
    if (status !== account.status) await this.payoutAccounts.setStatus(account.userId, status);
    return status;
  }

  private webUrl(): string {
    const url = this.config.get('WEB_URL');
    if (!url) throw new ServiceUnavailableException('Falta WEB_URL para conectar pagos');
    return url;
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
