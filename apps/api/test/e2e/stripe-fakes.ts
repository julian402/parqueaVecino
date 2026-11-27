import Stripe from 'stripe';
import type { AppConfigService } from '../../src/config/app-config.service';
import type {
  CreatePaymentCommand,
  CreatePayoutAccountCommand,
  ProviderPayment,
  ProviderPayoutStatus,
  RefundOptions,
} from '../../src/modules/payments/domain/payment-provider';
import { StripePaymentProvider } from '../../src/modules/payments/infrastructure/stripe-payment-provider';

/** Secreto de firma de las pruebas (en local lo imprime `stripe listen`). */
export const E2E_WEBHOOK_SECRET = 'whsec_e2e_parqueavecino';

/**
 * Adaptador de Stripe para e2e: la verificación de firma y la traducción de eventos son las
 * reales (`parseWebhook`); solo se reemplazan las llamadas de red a la API de Stripe.
 */
export class FakeStripeProvider extends StripePaymentProvider {
  readonly payments: (CreatePaymentCommand & { id: string })[] = [];
  readonly refunds: { id: string; options: RefundOptions }[] = [];
  readonly accounts: CreatePayoutAccountCommand[] = [];
  payoutStatus: ProviderPayoutStatus = 'action_required';
  private readonly statuses = new Map<string, ProviderPayment['status']>();

  constructor() {
    const values: Record<string, string> = {
      STRIPE_SECRET_KEY: 'sk_test_e2e',
      STRIPE_WEBHOOK_SECRET: E2E_WEBHOOK_SECRET,
    };
    super({ get: (key: string) => values[key] } as unknown as AppConfigService);
  }

  /** El navegador confirmó el pago (lo que hace el Payment Element con la tarjeta 4242). */
  markSucceeded(id: string): void {
    this.statuses.set(id, 'succeeded');
  }

  override createPayment(command: CreatePaymentCommand): Promise<ProviderPayment> {
    const id = `pi_e2e_${this.payments.length + 1}`;
    this.payments.push({ ...command, id });
    this.statuses.set(id, 'pending');
    return Promise.resolve({ id, status: 'pending', clientSecret: `${id}_secret_e2e` });
  }

  override getPayment(id: string): Promise<ProviderPayment> {
    const status = this.statuses.get(id) ?? 'pending';
    return Promise.resolve({ id, status, clientSecret: `${id}_secret_e2e` });
  }

  override cancelPayment(id: string): Promise<void> {
    this.statuses.set(id, 'canceled');
    return Promise.resolve();
  }

  override refundPayment(id: string, _key: string, options: RefundOptions): Promise<void> {
    this.refunds.push({ id, options });
    return Promise.resolve();
  }

  override createPayoutAccount(command: CreatePayoutAccountCommand): Promise<string> {
    this.accounts.push(command);
    return Promise.resolve(`acct_e2e_${this.accounts.length}`);
  }

  override getPayoutStatus(): Promise<ProviderPayoutStatus> {
    return Promise.resolve(this.payoutStatus);
  }

  override createOnboardingLink(accountId: string): Promise<string> {
    return Promise.resolve(`https://connect.stripe.com/setup/e/${accountId}/e2e`);
  }

  override createDashboardLink(accountId: string): Promise<string> {
    return Promise.resolve(`https://connect.stripe.com/express/${accountId}/e2e`);
  }
}

let eventCounter = 0;

/**
 * Evento con la misma forma que los que reenvía `stripe listen` (p. ej. tras
 * `stripe trigger payment_intent.succeeded`), firmado con el secreto de las pruebas.
 */
export function stripeEvent(type: string, object: Record<string, unknown>) {
  eventCounter += 1;
  const payload = JSON.stringify({
    id: `evt_e2e_${eventCounter}`,
    object: 'event',
    api_version: '2026-11-18.endive',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: `req_e2e_${eventCounter}`, idempotency_key: null },
    type,
    data: { object },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: E2E_WEBHOOK_SECRET,
  });
  return { payload, signature };
}

export const paymentIntent = (id: string, status: string, amount: number) => ({
  id,
  object: 'payment_intent',
  amount,
  amount_received: status === 'succeeded' ? amount : 0,
  currency: 'cop',
  status,
  livemode: false,
});

export const refundedCharge = (paymentIntentId: string, amount: number) => ({
  id: `ch_${paymentIntentId}`,
  object: 'charge',
  amount,
  amount_refunded: amount,
  currency: 'cop',
  payment_intent: paymentIntentId,
  refunded: true,
  livemode: false,
});
