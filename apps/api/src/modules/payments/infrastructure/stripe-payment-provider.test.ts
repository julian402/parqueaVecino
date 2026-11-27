import { BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import type { AppConfigService } from '../../../config/app-config.service';
import { StripePaymentProvider } from './stripe-payment-provider';

const WEBHOOK_SECRET = 'whsec_prueba_unitaria';

function provider() {
  const values: Record<string, string> = {
    STRIPE_SECRET_KEY: 'sk_test_prueba_unitaria',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  };
  const config = { get: (key: string) => values[key] } as unknown as AppConfigService;
  return new StripePaymentProvider(config);
}

describe('StripePaymentProvider.parseWebhook', () => {
  const payload = JSON.stringify({
    id: 'evt_1',
    object: 'event',
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_123', object: 'payment_intent' } },
  });

  it('acepta un evento con firma válida', () => {
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    expect(provider().parseWebhook(Buffer.from(payload), signature)).toEqual({
      type: 'payment.succeeded',
      paymentId: 'pi_123',
    });
  });

  it('rechaza con 400 una firma inválida', () => {
    expect(() => provider().parseWebhook(Buffer.from(payload), 't=1,v1=falsa')).toThrow(
      BadRequestException,
    );
  });
});
