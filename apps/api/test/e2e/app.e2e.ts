import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';

type Server = Parameters<typeof request>[0];

const API = '/api';
const password = 'clave1234';
const driver = { fullName: 'Conductor E2E', email: 'driver@e2e.test', password, role: 'DRIVER' };
const partner = { fullName: 'Aliado E2E', email: 'partner@e2e.test', password, role: 'PARTNER' };

const lotInput = {
  name: 'Parqueadero E2E',
  address: 'Calle 1 # 2-3',
  city: 'Bogotá',
  latitude: 4.65,
  longitude: -74.06,
  amenities: ['ROOF'],
};

/** Acceso directo a la BD de pruebas para lo que hoy solo hace un admin (verificar parqueaderos). */
async function withDb<T>(run: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}

const idOfLot = (name: string) =>
  withDb(async (db) => {
    const { rows } = await db.query<{ id: string }>('SELECT id FROM parking_lots WHERE name = $1', [
      name,
    ]);
    if (!rows[0]) throw new Error(`No existe el parqueadero ${name}`);
    return rows[0].id;
  });

const activateLot = (id: string) =>
  withDb((db) =>
    db.query("UPDATE parking_lots SET status = 'ACTIVE', verified_at = now() WHERE id = $1", [id]),
  );

describe('API e2e', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('auth', () => {
    it('registra, mantiene la sesión con cookies y cierra sesión', async () => {
      const agent = request.agent(server);
      const registered = await agent.post(`${API}/auth/register`).send(driver).expect(201);
      expect(registered.body).toMatchObject({ email: driver.email, role: 'DRIVER' });
      expect(registered.body).not.toHaveProperty('passwordHash');

      const cookies = registered.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('pv_access=') && c.includes('HttpOnly'))).toBe(true);
      expect(cookies.some((c) => c.startsWith('pv_refresh=') && c.includes('Path=/api/auth'))).toBe(
        true,
      );

      await agent.get(`${API}/auth/me`).expect(200);
      await agent.post(`${API}/auth/refresh`).expect(200);
      await agent.post(`${API}/auth/logout`).expect(204);
      await agent.post(`${API}/auth/refresh`).expect(401);
    });

    it('no permite correos duplicados ni roles admin', async () => {
      await request(server).post(`${API}/auth/register`).send(driver).expect(409);
      const admin = { ...driver, email: 'x@e2e.test', role: 'ADMIN' };
      const response = await request(server).post(`${API}/auth/register`).send(admin).expect(400);
      expect(response.body).toMatchObject({ statusCode: 400, message: 'Datos inválidos' });
    });

    it('rechaza credenciales incorrectas y peticiones sin sesión', async () => {
      await request(server)
        .post(`${API}/auth/login`)
        .send({ email: driver.email, password: 'mala1234' })
        .expect(401);
      await request(server).get(`${API}/auth/me`).expect(401);
    });
  });

  describe('vehículos', () => {
    it('normaliza la placa y evita duplicados', async () => {
      const agent = request.agent(server);
      await agent.post(`${API}/auth/login`).send({ email: driver.email, password }).expect(200);

      const created = await agent
        .post(`${API}/me/vehicles`)
        .send({ plate: 'abc 123', type: 'CAR' })
        .expect(201);
      expect(created.body).toMatchObject({ plate: 'ABC123' });

      await agent.post(`${API}/me/vehicles`).send({ plate: 'ABC-123', type: 'CAR' }).expect(409);
      const list = await agent.get(`${API}/me/vehicles`).expect(200);
      expect(list.body).toHaveLength(1);

      await agent.delete(`${API}/me/vehicles/${(created.body as { id: string }).id}`).expect(204);
    });
  });

  describe('parqueaderos del aliado', () => {
    it('crea un parqueadero, valida el tope de precio y protege por rol', async () => {
      const partnerAgent = request.agent(server);
      await partnerAgent.post(`${API}/auth/register`).send(partner).expect(201);

      const created = await partnerAgent
        .post(`${API}/partner/parking-lots`)
        .send(lotInput)
        .expect(201);
      const lot = created.body as { id: string; status: string };
      expect(lot.status).toBe('PENDING_VERIFICATION');

      const offer = { shift: 'NIGHT', vehicleType: 'CAR', totalSpots: 10, availableSpots: 4 };
      await partnerAgent
        .put(`${API}/partner/parking-lots/${lot.id}/offers`)
        .send({ offers: [{ ...offer, monthlyPriceMinor: 999_000_000 }] })
        .expect(400);

      const updated = await partnerAgent
        .put(`${API}/partner/parking-lots/${lot.id}/offers`)
        .send({ offers: [{ ...offer, monthlyPriceMinor: 17_000_000 }] })
        .expect(200);
      expect(updated.body).toMatchObject({
        offers: [{ shift: 'NIGHT', monthlyPriceMinor: 17_000_000, currency: 'COP' }],
      });

      // Un conductor no puede usar el panel de aliados.
      const driverAgent = request.agent(server);
      await driverAgent.post(`${API}/auth/login`).send({ email: driver.email, password });
      await driverAgent.get(`${API}/partner/parking-lots`).expect(403);

      // Aún no verificado: no es visible al público.
      await request(server).get(`${API}/parking-lots/${lot.id}`).expect(404);
    });
  });

  describe('búsqueda geoespacial', () => {
    const near = { lat: 4.6505, lng: -74.0605, shift: 'NIGHT', vehicleType: 'CAR' };

    it('solo muestra parqueaderos activos dentro del radio y aplica filtros', async () => {
      const lotId = await idOfLot(lotInput.name);

      // Pendiente de verificación: no aparece.
      const before = await request(server)
        .get(`${API}/parking-lots/search`)
        .query(near)
        .expect(200);
      expect(before.body).toMatchObject({ totalLots: 0, results: [] });

      await activateLot(lotId);

      const found = await request(server).get(`${API}/parking-lots/search`).query(near).expect(200);
      expect(found.body).toMatchObject({
        totalLots: 1,
        totalAvailableSpots: 4,
        results: [{ id: lotId, offer: { shift: 'NIGHT', monthlyPriceMinor: 17_000_000 } }],
      });
      const [first] = (found.body as { results: { distanceMeters: number }[] }).results;
      expect(first?.distanceMeters).toBeGreaterThan(0);
      expect(first?.distanceMeters).toBeLessThan(500);

      // Otra franja, precio máximo menor o radio corto: sin resultados.
      for (const filter of [
        { shift: 'DAY' },
        { maxPriceMinor: 10_000_000 },
        { radiusMeters: 50 },
        { amenities: 'CAMERAS' },
      ]) {
        const response = await request(server)
          .get(`${API}/parking-lots/search`)
          .query({ ...near, ...filter })
          .expect(200);
        expect(response.body).toMatchObject({ totalLots: 0 });
      }
    });

    it('valida la consulta', async () => {
      await request(server)
        .get(`${API}/parking-lots/search`)
        .query({ ...near, lat: 200 })
        .expect(400);
    });
  });

  it('expone los parámetros públicos', async () => {
    const response = await request(server).get(`${API}/settings/public`).expect(200);
    expect(response.body).toHaveProperty(['shift.schedule', 'NIGHT', 'start'], '18:00');
  });
});
