import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { FileStorage, type StoredFile } from '../../src/common/storage/file-storage';

type Server = Parameters<typeof request>[0];
type Agent = ReturnType<typeof request.agent>;

const API = '/api';
const password = 'clave1234';

/** Almacenamiento en memoria: simula S3 sin red (el PUT del navegador se hace con `put`). */
class MemoryStorage extends FileStorage {
  readonly enabled = true;
  readonly files = new Map<string, StoredFile>();
  createUploadTicket(input: { key: string; contentType: string }) {
    return Promise.resolve({
      url: `https://s3.e2e.test/${input.key}?firma=1`,
      headers: { 'Content-Type': input.contentType },
      expiresAt: new Date(Date.now() + 600_000),
    });
  }
  put(key: string, file: StoredFile) {
    this.files.set(key, file);
  }
  head(key: string) {
    return Promise.resolve(this.files.get(key) ?? null);
  }
  downloadUrl(key: string) {
    return Promise.resolve(`https://s3.e2e.test/${key}?descarga=1`);
  }
  delete(key: string) {
    this.files.delete(key);
    return Promise.resolve();
  }
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

describe('Verificación de documentos y ocupación del aliado e2e', () => {
  let app: INestApplication;
  let server: Server;
  let storage: MemoryStorage;
  let partner: Agent;
  let otherPartner: Agent;
  let lotId: string;
  let otherLotId: string;

  async function registerPartner(email: string): Promise<Agent> {
    const agent = request.agent(server);
    await agent
      .post(`${API}/auth/register`)
      .send({ fullName: 'Aliado Documentos', email, password, role: 'PARTNER' })
      .expect(201);
    return agent;
  }

  async function createLot(agent: Agent, name: string): Promise<string> {
    const lot = await agent
      .post(`${API}/partner/parking-lots`)
      .send({
        // Lejos de Chapinero: no interfiere con las pruebas de búsqueda.
        name,
        address: 'Calle 10 # 5-20',
        city: 'Cali',
        latitude: 3.4516,
        longitude: -76.532,
        amenities: [],
      })
      .expect(201);
    return (lot.body as { id: string }).id;
  }

  beforeAll(async () => {
    storage = new MemoryStorage();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FileStorage)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;

    partner = await registerPartner('aliado@documentos.test');
    otherPartner = await registerPartner('otro@documentos.test');
    lotId = await createLot(partner, 'Parqueadero Documentos E2E');
    otherLotId = await createLot(otherPartner, 'Parqueadero Ajeno E2E');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('documentos de verificación', () => {
    let documentId: string;

    it('sube la póliza con URL prefirmada y queda pendiente de revisión', async () => {
      const empty = await partner.get(`${API}/partner/parking-lots/${lotId}/documents`).expect(200);
      expect(empty.body).toMatchObject({ uploadsEnabled: true, documents: [] });
      const maxFileBytes = (empty.body as { maxFileBytes: number }).maxFileBytes;

      await partner
        .post(`${API}/partner/parking-lots/${lotId}/documents/upload-url`)
        .send({
          type: 'LIABILITY_POLICY',
          fileName: 'poliza.pdf',
          contentType: 'application/pdf',
          sizeBytes: maxFileBytes + 1,
        })
        .expect(400);

      const ticket = await partner
        .post(`${API}/partner/parking-lots/${lotId}/documents/upload-url`)
        .send({
          type: 'LIABILITY_POLICY',
          fileName: 'poliza.pdf',
          contentType: 'application/pdf',
          sizeBytes: 2048,
        })
        .expect(201);
      const { key, headers } = ticket.body as { key: string; headers: Record<string, string> };
      expect(headers['Content-Type']).toBe('application/pdf');

      // Sin fecha de vencimiento la póliza no se acepta.
      await partner
        .post(`${API}/partner/parking-lots/${lotId}/documents`)
        .send({ type: 'LIABILITY_POLICY', key, fileName: 'poliza.pdf' })
        .expect(400);
      // Aún no se subió el archivo.
      await partner
        .post(`${API}/partner/parking-lots/${lotId}/documents`)
        .send({ type: 'LIABILITY_POLICY', key, fileName: 'poliza.pdf', expiresAt: '2099-12-31' })
        .expect(400);

      storage.put(key, { sizeBytes: 2048, contentType: 'application/pdf' });
      const submitted = await partner
        .post(`${API}/partner/parking-lots/${lotId}/documents`)
        .send({ type: 'LIABILITY_POLICY', key, fileName: 'poliza.pdf', expiresAt: '2099-12-31' })
        .expect(201);
      expect(submitted.body).toMatchObject({
        type: 'LIABILITY_POLICY',
        status: 'PENDING_REVIEW',
        expiresAt: '2099-12-31',
      });
      expect(submitted.body).not.toHaveProperty('fileKey');
      documentId = (submitted.body as { id: string }).id;

      const link = await partner
        .get(`${API}/partner/parking-lots/${lotId}/documents/${documentId}/file`)
        .expect(200);
      expect((link.body as { url: string }).url).toContain(key);
    });

    it('otro aliado no ve ni sube documentos de un parqueadero ajeno (404)', async () => {
      await otherPartner.get(`${API}/partner/parking-lots/${lotId}/documents`).expect(404);
      await otherPartner
        .post(`${API}/partner/parking-lots/${lotId}/documents/upload-url`)
        .send({ type: 'RUT', fileName: 'rut.pdf', contentType: 'application/pdf', sizeBytes: 10 })
        .expect(404);
      await otherPartner
        .get(`${API}/partner/parking-lots/${otherLotId}/documents/${documentId}/file`)
        .expect(404);
    });

    it('solo el admin revisa; rechazar exige motivo; aprobar deja el documento aprobado', async () => {
      await partner.get(`${API}/admin/documents`).expect(403);

      const admin = request.agent(server);
      await admin
        .post(`${API}/auth/login`)
        .send({
          email: process.env.SEED_ADMIN_EMAIL,
          password: process.env.SEED_ADMIN_PASSWORD,
        })
        .expect(200);

      const queue = await admin.get(`${API}/admin/documents?status=PENDING_REVIEW`).expect(200);
      const items = (queue.body as { items: { id: string; parkingLot: { name: string } }[] }).items;
      expect(items.find((d) => d.id === documentId)?.parkingLot.name).toBe(
        'Parqueadero Documentos E2E',
      );

      await admin
        .patch(`${API}/admin/documents/${documentId}/review`)
        .send({ status: 'REJECTED' })
        .expect(400);
      const approved = await admin
        .patch(`${API}/admin/documents/${documentId}/review`)
        .send({ status: 'APPROVED' })
        .expect(200);
      expect(approved.body).toMatchObject({ status: 'APPROVED', rejectionReason: null });
      await admin.get(`${API}/admin/documents/${documentId}/file`).expect(200);

      const list = await partner.get(`${API}/partner/parking-lots/${lotId}/documents`).expect(200);
      expect(list.body).toMatchObject({ documents: [{ id: documentId, status: 'APPROVED' }] });
    });
  });

  describe('ocupación por hora (partner-analytics)', () => {
    it('cuenta las mensualidades vigentes en las horas de su franja', async () => {
      await partner
        .put(`${API}/partner/parking-lots/${lotId}/offers`)
        .send({
          offers: [
            { shift: 'DAY', vehicleType: 'CAR', totalSpots: 4, monthlyPriceMinor: 15_000_000 },
          ],
        })
        .expect(200);
      const driver = request.agent(server);
      await driver
        .post(`${API}/auth/register`)
        .send({
          fullName: 'Conductor Ocupación',
          email: 'conductor@ocupacion.test',
          password,
          role: 'DRIVER',
        })
        .expect(201);

      // Mensualidad diurna activa desde hace 10 días (la reserva y el pago se prueban aparte).
      await withDb((db) =>
        db.query(
          `INSERT INTO bookings (id, driver_id, parking_lot_id, offer_id, shift, vehicle_type, plate,
             price_minor, currency, status, starts_at, ends_at, updated_at)
           SELECT gen_random_uuid(), u.id, o.parking_lot_id, o.id, 'DAY', 'CAR', 'OCU123',
             o.monthly_price_minor, o.currency, 'ACTIVE', now() - interval '10 days',
             now() + interval '20 days', now()
           FROM users u, offers o
           WHERE u.email = 'conductor@ocupacion.test' AND o.parking_lot_id = $1`,
          [lotId],
        ),
      );

      const res = await partner
        .get(`${API}/partner/analytics/occupancy?days=7&parkingLotId=${lotId}`)
        .expect(200);
      const body = res.body as {
        hours: { hour: number; occupied: number; capacity: number; rate: number }[];
        peakHour: number | null;
      };
      expect(body.hours).toHaveLength(24);
      expect(body.hours[10]).toMatchObject({ occupied: 1, capacity: 4, rate: 0.25 });
      expect(body.hours[22]).toMatchObject({ occupied: 0, capacity: 0 });
      expect(body.peakHour).not.toBeNull();
    });

    it('valida el rango y no deja consultar parqueaderos ajenos', async () => {
      await partner.get(`${API}/partner/analytics/occupancy?days=99`).expect(400);
      await partner
        .get(`${API}/partner/analytics/occupancy?parkingLotId=${otherLotId}`)
        .expect(404);
    });
  });
});
