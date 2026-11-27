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
  type PaymentEvent,
  type ProviderPayment,
  type ProviderPaymentStatus,
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

/** Adaptador de Stripe (solo modo test). Único lugar del código que usa el SDK de Stripe. */
@Injectable()
export class StripePaymentProvider extends PaymentProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly client: Stripe | null;
  private readonly webhookSecret: string | undefined;

  constructor(config: AppConfigService) {
    super();
    const key = config.get('STRIPE_SECRET_KEY');
    this.client = key ? new Stripe(key) : null;
    this.webhookSecret = config.get('STRIPE_WEBHOOK_SECRET') || undefined;
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

  async refundPayment(id: string, idempotencyKey: string): Promise<void> {
    await this.stripe.refunds.create({ payment_intent: id }, { idempotencyKey });
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
