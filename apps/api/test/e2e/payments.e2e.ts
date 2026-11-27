import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { PaymentProvider } from '../../src/modules/payments/domain/payment-provider';
import { FakeStripeProvider, paymentIntent, refundedCharge, stripeEvent } from './stripe-fakes';

type Server = Parameters<typeof request>[0];
type Agent = ReturnType<typeof request.agent>;

const API = '/api';
const WEBHOOK = `${API}/payments/webhooks/stripe`;
const PRICE = 18_000_000;
const password = 'clave1234';

interface BookingBody {
  booking: { id: string; status: string; plate: string; accessCode: string | null };
  clientSecret: string | null;
}

async function withDb<T>(run: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}

const availableSpots = (offerId: string) =>
  withDb(async (db) => {
    const { rows } = await db.query<{ available_spots: number }>(
      'SELECT available_spots FROM offers WHERE id = $1',
      [offerId],
    );
    return rows[0]?.available_spots;
  });

describe('Pagos e2e (webhooks de Stripe, reserva como invitado y Connect)', () => {
  let app: INestApplication;
  let server: Server;
  let stripe: FakeStripeProvider;
  let partner: Agent;
  let offerId: string;
  let lotId: string;

  const sendWebhook = (event: { payload: string; signature: string }) =>
    request(server)
      .post(WEBHOOK)
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', event.signature)
      .send(event.payload);

  /** Conductor nuevo con una reserva pendiente de pago. */
  async function driverWithBooking(email: string, plate: string) {
    const agent = request.agent(server);
    await agent
      .post(`${API}/auth/register`)
      .send({ fullName: 'Conductor Pagos', email, password, role: 'DRIVER' })
      .expect(201);
    const created = await agent.post(`${API}/bookings`).send({ offerId, plate }).expect(201);
    const body = created.body as BookingBody;
    const payment = stripe.payments.at(-1);
    if (!payment) throw new Error('No se creó el PaymentIntent');
    return { agent, booking: body.booking, paymentIntentId: payment.id };
  }

  beforeAll(async () => {
    stripe = new FakeStripeProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PaymentProvider)
      .useValue(stripe)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;

    // Aliado con un parqueadero publicado y 10 cupos de noche para carro.
    partner = request.agent(server);
    await partner
      .post(`${API}/auth/register`)
      .send({ fullName: 'Aliado Pagos', email: 'aliado@pagos.test', password, role: 'PARTNER' })
      .expect(201);
    const lot = await partner
      .post(`${API}/partner/parking-lots`)
      .send({
        // Lejos de Chapinero: no interfiere con las pruebas de búsqueda.
        name: 'Parqueadero Pagos E2E',
        address: 'Carrera 43A # 1-50',
        city: 'Medellín',
        latitude: 6.2442,
        longitude: -75.5812,
        amenities: [],
      })
      .expect(201);
    lotId = (lot.body as { id: string }).id;
    const withOffers = await partner
      .put(`${API}/partner/parking-lots/${lotId}/offers`)
      .send({
        offers: [{ shift: 'NIGHT', vehicleType: 'CAR', totalSpots: 10, monthlyPriceMinor: PRICE }],
      })
      .expect(200);
    offerId = (withOffers.body as { offers: { id: string }[] }).offers[0]?.id ?? '';
    await withDb((db) =>
      db.query("UPDATE parking_lots SET status = 'ACTIVE', verified_at = now() WHERE id = $1", [
        lotId,
      ]),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    stripe.payoutStatus = 'action_required';
  });

  describe('reservar sin cuenta (invitado → cuenta)', () => {
    it('registra, guarda la placa, reserva y tras el pago la mensualidad queda en su cuenta', async () => {
      const guest = request.agent(server);
      // 1. Registro como conductor con los datos del formulario de la ficha.
      await guest
        .post(`${API}/auth/register`)
        .send({ fullName: 'Ana Invitada', email: 'ana@pagos.test', password, role: 'DRIVER' })
        .expect(201);
      // 2. Reserva con la placa (se normaliza y se guarda en "Mis vehículos").
      const created = await guest
        .post(`${API}/bookings`)
        .send({ offerId, plate: 'jkl-123' })
        .expect(201);
      const { booking, clientSecret } = created.body as BookingBody;
      expect(booking).toMatchObject({ status: 'PENDING_PAYMENT', plate: 'JKL123' });
      expect(clientSecret).toMatch(/_secret_/);
      const vehicles = await guest.get(`${API}/me/vehicles`).expect(200);
      expect(vehicles.body).toEqual([expect.objectContaining({ plate: 'JKL123', type: 'CAR' })]);

      // 3. Stripe confirma el pago por webhook.
      const intent = stripe.payments.at(-1);
      expect(intent).toMatchObject({ amountMinor: PRICE, commissionMinor: PRICE / 10 });
      await sendWebhook(
        stripeEvent(
          'payment_intent.succeeded',
          paymentIntent(intent?.id ?? '', 'succeeded', PRICE),
        ),
      ).expect(200);

      // 4. "Mis mensualidades": activa, con código de ingreso y recibo.
      const mine = await guest.get(`${API}/bookings`).expect(200);
      const [active] = mine.body as BookingBody['booking'][];
      expect(mine.body).toHaveLength(1);
      expect(active).toMatchObject({ id: booking.id, status: 'ACTIVE' });
      expect(active?.accessCode).toMatch(/^[A-Z2-9]{8}$/);
      const receipt = await guest.get(`${API}/bookings/${booking.id}/receipt`).expect(200);
      expect(receipt.body).toMatchObject({
        driver: { fullName: 'Ana Invitada', email: 'ana@pagos.test' },
        payment: { status: 'SUCCEEDED', amountMinor: PRICE },
      });
    });

    it('si el correo ya existe responde 409 y no aparta cupo', async () => {
      const before = await availableSpots(offerId);
      await request(server)
        .post(`${API}/auth/register`)
        .send({ fullName: 'Ana Otra', email: 'ana@pagos.test', password, role: 'DRIVER' })
        .expect(409);
      expect(await availableSpots(offerId)).toBe(before);
    });
  });

  describe('webhook de Stripe', () => {
    it('rechaza eventos sin firma o con firma inválida y no cambia nada', async () => {
      const { booking, paymentIntentId, agent } = await driverWithBooking(
        'firma@pagos.test',
        'FIR123',
      );
      const event = stripeEvent(
        'payment_intent.succeeded',
        paymentIntent(paymentIntentId, 'succeeded', PRICE),
      );
      await request(server)
        .post(WEBHOOK)
        .set('Content-Type', 'application/json')
        .send(event.payload)
        .expect(400);
      const forged = await request(server)
        .post(WEBHOOK)
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`)
        .send(event.payload)
        .expect(400);
      expect(forged.body).toMatchObject({ statusCode: 400, message: 'Firma de webhook inválida' });
      // Firma válida de otro cuerpo: tampoco.
      await sendWebhook({
        payload: event.payload.replace('succeeded', 'canceled'),
        signature: event.signature,
      }).expect(400);

      const checkout = await agent.get(`${API}/bookings/${booking.id}/checkout`).expect(200);
      expect((checkout.body as BookingBody).booking.status).toBe('PENDING_PAYMENT');
      await agent.post(`${API}/bookings/${booking.id}/cancel`).expect(200);
    });

    it('es idempotente: un evento repetido no genera otro código ni cambia la vigencia', async () => {
      const { agent, booking, paymentIntentId } = await driverWithBooking(
        'repetido@pagos.test',
        'REP123',
      );
      const succeeded = paymentIntent(paymentIntentId, 'succeeded', PRICE);
      await sendWebhook(stripeEvent('payment_intent.succeeded', succeeded)).expect(200);
      const first = await agent.get(`${API}/bookings/${booking.id}/checkout`).expect(200);
      // Stripe reintenta la entrega (mismo evento) y también puede llegar uno nuevo.
      await sendWebhook(stripeEvent('payment_intent.succeeded', succeeded)).expect(200);
      const second = await agent.get(`${API}/bookings/${booking.id}/checkout`).expect(200);
      expect((second.body as BookingBody).booking).toEqual((first.body as BookingBody).booking);
      expect((second.body as BookingBody).booking.status).toBe('ACTIVE');
    });

    it('un pago rechazado deja la reserva pendiente para reintentar', async () => {
      const { agent, booking, paymentIntentId } = await driverWithBooking(
        'rechazo@pagos.test',
        'REC123',
      );
      await sendWebhook(
        stripeEvent(
          'payment_intent.payment_failed',
          paymentIntent(paymentIntentId, 'requires_payment_method', PRICE),
        ),
      ).expect(200);
      const checkout = await agent.get(`${API}/bookings/${booking.id}/checkout`).expect(200);
      const retry = checkout.body as BookingBody;
      expect(retry.booking.status).toBe('PENDING_PAYMENT');
      // El checkout puede reintentar con otra tarjeta sobre el mismo PaymentIntent.
      expect(retry.clientSecret).toBe(`${paymentIntentId}_secret_e2e`);
      await agent.post(`${API}/bookings/${booking.id}/cancel`).expect(200);
    });

    it('un reembolso hecho desde Stripe anula la mensualidad y libera el cupo', async () => {
      const { agent, booking, paymentIntentId } = await driverWithBooking(
        'reembolso@pagos.test',
        'RMB123',
      );
      await sendWebhook(
        stripeEvent('payment_intent.succeeded', paymentIntent(paymentIntentId, 'succeeded', PRICE)),
      ).expect(200);
      const occupied = await availableSpots(offerId);

      await sendWebhook(
        stripeEvent('charge.refunded', refundedCharge(paymentIntentId, PRICE)),
      ).expect(200);
      const mine = await agent.get(`${API}/bookings`).expect(200);
      expect(mine.body).toEqual([expect.objectContaining({ id: booking.id, status: 'REFUNDED' })]);
      expect(await availableSpots(offerId)).toBe((occupied ?? 0) + 1);
    });

    it('ignora eventos que no usa y pagos que no son de la plataforma', async () => {
      await sendWebhook(
        stripeEvent('customer.created', { id: 'cus_1', object: 'customer' }),
      ).expect(200);
      await sendWebhook(
        stripeEvent('payment_intent.succeeded', paymentIntent('pi_desconocido', 'succeeded', 1)),
      ).expect(200);
    });
  });

  describe('Stripe Connect del aliado', () => {
    it('solo el aliado ve y conecta su cuenta de pagos', async () => {
      const driver = request.agent(server);
      await driver
        .post(`${API}/auth/login`)
        .send({ email: 'ana@pagos.test', password })
        .expect(200);
      await driver.get(`${API}/partner/payout-account`).expect(403);
      await request(server).post(`${API}/partner/payout-account/onboarding`).expect(401);
    });

    it('conecta la cuenta, y cuando está activa el pago va al aliado menos la comisión', async () => {
      const initial = await partner.get(`${API}/partner/payout-account`).expect(200);
      expect(initial.body).toEqual({ paymentsEnabled: true, status: null });
      await partner.post(`${API}/partner/payout-account/dashboard`).expect(404);

      const onboarding = await partner.post(`${API}/partner/payout-account/onboarding`).expect(201);
      expect(onboarding.body).toEqual({ url: 'https://connect.stripe.com/setup/e/acct_e2e_1/e2e' });
      // Volver a entrar (enlace vencido) reutiliza la misma cuenta.
      await partner.post(`${API}/partner/payout-account/onboarding`).expect(201);
      expect(stripe.accounts).toHaveLength(1);
      expect(stripe.accounts[0]).toMatchObject({ email: 'aliado@pagos.test' });

      // Onboarding sin terminar: cobra la plataforma.
      const pending = await partner.get(`${API}/partner/payout-account`).expect(200);
      expect(pending.body).toMatchObject({ status: 'ACTION_REQUIRED' });
      await driverWithBooking('sinconnect@pagos.test', 'SIN123');
      expect(stripe.payments.at(-1)?.destinationAccountId).toBeUndefined();

      // Stripe activa las transferencias: cargo con destino y application fee del 10 %.
      stripe.payoutStatus = 'active';
      const active = await partner.get(`${API}/partner/payout-account`).expect(200);
      expect(active.body).toMatchObject({ status: 'ACTIVE' });
      const { agent, booking, paymentIntentId } = await driverWithBooking(
        'connect@pagos.test',
        'CON123',
      );
      expect(stripe.payments.at(-1)).toMatchObject({
        destinationAccountId: 'acct_e2e_1',
        commissionMinor: PRICE / 10,
      });
      const dashboard = await partner.post(`${API}/partner/payout-account/dashboard`).expect(201);
      expect(dashboard.body).toEqual({ url: 'https://connect.stripe.com/express/acct_e2e_1/e2e' });

      // Cancelar dentro de la ventana gratuita revierte la transferencia al aliado.
      stripe.markSucceeded(paymentIntentId);
      await agent.get(`${API}/bookings/${booking.id}/checkout`).expect(200);
      await agent.post(`${API}/bookings/${booking.id}/cancel`).expect(200);
      expect(stripe.refunds.at(-1)).toEqual({
        id: paymentIntentId,
        options: { reverseTransfer: true },
      });
    });
  });
});
