import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { AppConfigService } from '../../../config/app-config.service';
import {
  PaymentProvider,
  type CreatePaymentCommand,
  type CreatePayoutAccountCommand,
  type OnboardingUrls,
  type PaymentEvent,
  type ProviderPayment,
  type ProviderPaymentStatus,
  type ProviderPayoutStatus,
  type RefundOptions,
} from '../domain/payment-provider';

function toStatus(status: Stripe.PaymentIntent.Status): ProviderPaymentStatus {
  switch (status) {
    case 'succeeded':
      return 'succeeded';
    case 'canceled':
      return 'canceled';
    default:
      // requires_payment_method tras un rechazo sigue siendo reintentable desde el checkout.
      return 'pending';
  }
}

function toProviderPayment(intent: Stripe.PaymentIntent): ProviderPayment {
  return { id: intent.id, status: toStatus(intent.status), clientSecret: intent.client_secret };
}

type TransfersStatus = 'active' | 'pending' | 'rejected' | 'restricted' | 'unsupported';

/** Capacidad de recibir transferencias (Accounts v2) → estado del dominio. */
export function toPayoutStatus(status: TransfersStatus | undefined): ProviderPayoutStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'pending':
      return 'pending';
    default:
      // Sin pedir aún, restringida o rechazada: el aliado debe completar o corregir datos.
      return 'action_required';
  }
}

/** Adaptador de Stripe (solo modo test). Único lugar del código que usa el SDK de Stripe. */
@Injectable()
export class StripePaymentProvider extends PaymentProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly client: Stripe | null;
  private readonly webhookSecret: string | undefined;

  private readonly connectCountry: string | undefined;

  constructor(config: AppConfigService) {
    super();
    const key = config.get('STRIPE_SECRET_KEY');
    this.client = key ? new Stripe(key) : null;
    this.webhookSecret = config.get('STRIPE_WEBHOOK_SECRET') || undefined;
    this.connectCountry = config.get('STRIPE_CONNECT_COUNTRY');
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  private get stripe(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException('Los pagos no están configurados (STRIPE_SECRET_KEY)');
    }
    return this.client;
  }

  async createPayment(command: CreatePaymentCommand): Promise<ProviderPayment> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: command.amountMinor,
        currency: command.currency.toLowerCase(),
        description: command.description,
        automatic_payment_methods: { enabled: true },
        metadata: { ...command.metadata, commissionMinor: String(command.commissionMinor) },
        // Cargo con destino (marketplace): el aliado recibe el pago y la plataforma su comisión.
        ...(command.destinationAccountId && {
          application_fee_amount: command.commissionMinor,
          transfer_data: { destination: command.destinationAccountId },
        }),
      },
      { idempotencyKey: command.idempotencyKey },
    );
    return toProviderPayment(intent);
  }

  async getPayment(id: string): Promise<ProviderPayment> {
    return toProviderPayment(await this.stripe.paymentIntents.retrieve(id));
  }

  async cancelPayment(id: string): Promise<void> {
    try {
      await this.stripe.paymentIntents.cancel(id);
    } catch (error) {
      // Si ya estaba cancelado o pagado, no hay nada que hacer.
      this.logger.warn({ err: error, id }, 'No se pudo cancelar el PaymentIntent');
    }
  }

  async refundPayment(id: string, idempotencyKey: string, options: RefundOptions): Promise<void> {
    await this.stripe.refunds.create(
      {
        payment_intent: id,
        // El dinero vuelve desde la cuenta del aliado y la plataforma devuelve su comisión.
        ...(options.reverseTransfer && { reverse_transfer: true, refund_application_fee: true }),
      },
      { idempotencyKey },
    );
  }

  /** Errores de Stripe en Connect → 503 con mensaje claro (llave vencida, Connect sin activar…). */
  private async connect<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof Stripe.errors.StripeError)) throw error;
      this.logger.error({ err: error, code: error.code }, 'Falló una llamada a Stripe Connect');
      throw new ServiceUnavailableException('No pudimos conectar con Stripe. Intenta más tarde.');
    }
  }

  async createPayoutAccount(command: CreatePayoutAccountCommand): Promise<string> {
    // Accounts v2, marketplace: panel Express, la plataforma cobra las tarifas y asume pérdidas.
    const account = await this.connect(() =>
      this.stripe.v2.core.accounts.create(
        {
          contact_email: command.email,
          display_name: command.displayName,
          dashboard: 'express',
          ...(this.connectCountry && { identity: { country: this.connectCountry } }),
          defaults: {
            responsibilities: { fees_collector: 'application', losses_collector: 'application' },
          },
          configuration: {
            recipient: {
              capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
            },
          },
          metadata: command.metadata,
        },
        { idempotencyKey: command.idempotencyKey },
      ),
    );
    return account.id;
  }

  async getPayoutStatus(accountId: string): Promise<ProviderPayoutStatus> {
    const account = await this.stripe.v2.core.accounts.retrieve(accountId, {
      include: ['configuration.recipient'],
    });
    return toPayoutStatus(
      account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status,
    );
  }

  async createOnboardingLink(accountId: string, urls: OnboardingUrls): Promise<string> {
    const link = await this.connect(() =>
      this.stripe.v2.core.accountLinks.create({
        account: accountId,
        use_case: {
          type: 'account_onboarding',
          account_onboarding: {
            refresh_url: urls.refreshUrl,
            return_url: urls.returnUrl,
          },
        },
      }),
    );
    return link.url;
  }

  async createDashboardLink(accountId: string): Promise<string> {
    return (await this.connect(() => this.stripe.accounts.createLoginLink(accountId))).url;
  }

  parseWebhook(rawBody: Buffer, signature: string): PaymentEvent | null {
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException('Falta STRIPE_WEBHOOK_SECRET');
    }
    // Si la firma no corresponde se rechaza (400): nunca se procesa un evento sin verificar.
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
        throw new BadRequestException('Firma de webhook inválida');
      }
      throw error;
    }
    switch (event.type) {
      case 'payment_intent.succeeded':
        return { type: 'payment.succeeded', paymentId: event.data.object.id };
      case 'payment_intent.payment_failed':
        return { type: 'payment.declined', paymentId: event.data.object.id };
      case 'payment_intent.canceled':
        return { type: 'payment.failed', paymentId: event.data.object.id };
      case 'charge.refunded': {
        const intent = event.data.object.payment_intent;
        if (!intent) return null;
        return {
          type: 'payment.refunded',
          paymentId: typeof intent === 'string' ? intent : intent.id,
        };
      }
      default:
        return null;
    }
  }
}
