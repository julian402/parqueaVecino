import { BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import type { AppConfigService } from '../../../config/app-config.service';
import { StripePaymentProvider, toPayoutStatus } from './stripe-payment-provider';

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

  it('un rechazo de tarjeta es reintentable; una cancelación cierra el cobro', () => {
    const parse = (type: string) => {
      const body = JSON.stringify({
        id: 'evt_2',
        object: 'event',
        type,
        data: { object: { id: 'pi_9', object: 'payment_intent' } },
      });
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload: body,
        secret: WEBHOOK_SECRET,
      });
      return provider().parseWebhook(Buffer.from(body), signature);
    };
    expect(parse('payment_intent.payment_failed')).toEqual({
      type: 'payment.declined',
      paymentId: 'pi_9',
    });
    expect(parse('payment_intent.canceled')).toEqual({ type: 'payment.failed', paymentId: 'pi_9' });
  });

  it('rechaza con 400 una firma inválida', () => {
    expect(() => provider().parseWebhook(Buffer.from(payload), 't=1,v1=falsa')).toThrow(
      BadRequestException,
    );
  });
});

describe('toPayoutStatus', () => {
  it('solo una cuenta con transferencias activas recibe cargos con destino', () => {
    expect(toPayoutStatus('active')).toBe('active');
    expect(toPayoutStatus('pending')).toBe('pending');
    for (const status of ['restricted', 'rejected', 'unsupported', undefined] as const) {
      expect(toPayoutStatus(status)).toBe('action_required');
    }
  });
});
