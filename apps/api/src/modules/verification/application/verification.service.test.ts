import { NotFoundException } from '@nestjs/common';
import {
  DocumentStatus,
  type AdminDocumentListQuery,
  type DocumentStatus as Status,
  type DocumentType,
} from '@parqueavecino/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileStorage, type StoredFile } from '../../../common/storage/file-storage';
import type { AppConfigService } from '../../../config/app-config.service';
import type { NotificationsService } from '../../notifications/application/notifications.service';
import type { ParkingLotsService } from '../../parking-lots/application/parking-lots.service';
import type { SettingsService } from '../../settings/application/settings.service';
import {
  DocumentsRepository,
  type DocumentRecord,
  type DocumentUpload,
  type DocumentWithContext,
} from '../domain/documents.repository';
import { documentKeyPrefix, VerificationService } from './verification.service';

const LOT = '11111111-1111-4111-8111-111111111111';
const OTHER_LOT = '22222222-2222-4222-8222-222222222222';
const partner = { id: 'p1', fullName: 'Aliado Uno', email: 'aliado@test.co' };

class MemoryDocuments extends DocumentsRepository {
  rows: DocumentWithContext[] = [];
  listByLot(parkingLotId: string) {
    return Promise.resolve(this.rows.filter((r) => r.parkingLotId === parkingLotId));
  }
  // Copias, como las filas nuevas que devuelve Prisma en cada consulta.
  findById(id: string) {
    const row = this.rows.find((r) => r.id === id);
    return Promise.resolve(row ? { ...row } : null);
  }
  findByLotAndType(parkingLotId: string, type: DocumentType) {
    const row = this.rows.find((r) => r.parkingLotId === parkingLotId && r.type === type);
    return Promise.resolve(row ? { ...row } : null);
  }
  upsert(data: DocumentUpload): Promise<DocumentRecord> {
    const existing = this.rows.find(
      (r) => r.parkingLotId === data.parkingLotId && r.type === data.type,
    );
    const values = {
      ...data,
      status: DocumentStatus.PENDING_REVIEW as Status,
      rejectionReason: null,
      reviewedAt: null,
      expiryNoticeSentAt: null,
      uploadedAt: new Date().toISOString(),
    };
    if (existing) {
      Object.assign(existing, values);
      return Promise.resolve(existing);
    }
    const row: DocumentWithContext = {
      id: `d${this.rows.length + 1}`,
      ...values,
      parkingLot: { id: data.parkingLotId, name: 'Lote Calle 63' },
      partner,
    };
    this.rows.push(row);
    return Promise.resolve(row);
  }
  review(id: string, status: Status, rejectionReason: string | null) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('no existe');
    Object.assign(row, { status, rejectionReason, reviewedAt: new Date().toISOString() });
    return Promise.resolve(row);
  }
  listForAdmin(_query: AdminDocumentListQuery) {
    return Promise.resolve({ items: this.rows, total: this.rows.length });
  }
  findExpiringWithoutNotice(lastDay: string) {
    return Promise.resolve(
      this.rows.filter(
        (r) =>
          r.status === DocumentStatus.APPROVED &&
          !r.expiryNoticeSentAt &&
          r.expiresAt !== null &&
          r.expiresAt <= lastDay,
      ),
    );
  }
  findExpired(today: string) {
    return Promise.resolve(
      this.rows.filter(
        (r) =>
          (r.status === DocumentStatus.APPROVED || r.status === DocumentStatus.PENDING_REVIEW) &&
          r.expiresAt !== null &&
          r.expiresAt < today,
      ),
    );
  }
  markNoticeSent(id: string, at: Date) {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.expiryNoticeSentAt = at;
    return Promise.resolve();
  }
  markExpired(id: string) {
    const row = this.rows.find((r) => r.id === id);
    if (!row || row.status === DocumentStatus.EXPIRED) return Promise.resolve(false);
    row.status = DocumentStatus.EXPIRED;
    return Promise.resolve(true);
  }
}

class MemoryStorage extends FileStorage {
  readonly enabled = true;
  files = new Map<string, StoredFile>();
  deleted: string[] = [];
  createUploadTicket(input: { key: string; contentType: string }) {
    return Promise.resolve({
      url: `https://s3.test/${input.key}`,
      headers: { 'Content-Type': input.contentType },
      expiresAt: new Date(),
    });
  }
  head(key: string) {
    return Promise.resolve(this.files.get(key) ?? null);
  }
  downloadUrl(key: string) {
    return Promise.resolve(`https://s3.test/${key}?firma`);
  }
  delete(key: string) {
    this.deleted.push(key);
    this.files.delete(key);
    return Promise.resolve();
  }
}

describe('VerificationService', () => {
  let repo: MemoryDocuments;
  let storage: MemoryStorage;
  let lots: {
    getForPartner: ReturnType<typeof vi.fn>;
    revokeVerification: ReturnType<typeof vi.fn>;
  };
  let notifications: Record<
    'documentExpiring' | 'documentExpired' | 'documentReviewed',
    ReturnType<typeof vi.fn>
  >;
  let service: VerificationService;
  // "Hoy" en Bogotá: 2026-05-10.
  const now = new Date('2026-05-10T15:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers({ now, toFake: ['Date'] });
    repo = new MemoryDocuments();
    storage = new MemoryStorage();
    lots = {
      getForPartner: vi.fn((partnerId: string, lotId: string) =>
        partnerId === partner.id && lotId === LOT
          ? Promise.resolve({ id: lotId })
          : Promise.reject(new NotFoundException()),
      ),
      revokeVerification: vi.fn(),
    };
    notifications = {
      documentExpiring: vi.fn().mockResolvedValue(true),
      documentExpired: vi.fn().mockResolvedValue(true),
      documentReviewed: vi.fn().mockResolvedValue(true),
    };
    const settings: Record<string, number> = {
      'verification.maxFileBytes': 1000,
      'verification.expiryNoticeDays': 20,
    };
    service = new VerificationService(
      repo,
      storage,
      lots as unknown as ParkingLotsService,
      { get: (key: string) => Promise.resolve(settings[key]) } as unknown as SettingsService,
      notifications as unknown as NotificationsService,
      { register: vi.fn() },
      { get: () => 'America/Bogota' } as unknown as AppConfigService,
    );
  });

  /** Simula el PUT del navegador a la URL prefirmada. */
  async function upload(
    type: DocumentType,
    file: StoredFile = { sizeBytes: 500, contentType: 'application/pdf' },
  ) {
    const ticket = await service.createUploadTicket(partner.id, LOT, {
      type,
      fileName: 'poliza.pdf',
      contentType: 'application/pdf',
      sizeBytes: file.sizeBytes,
    });
    storage.files.set(ticket.key, file);
    return ticket.key;
  }

  it('sube con URL prefirmada y registra el documento pendiente de revisión', async () => {
    const key = await upload('LIABILITY_POLICY');
    expect(key.startsWith(documentKeyPrefix(LOT, 'LIABILITY_POLICY'))).toBe(true);
    const doc = await service.submit(partner.id, LOT, {
      type: 'LIABILITY_POLICY',
      key,
      fileName: 'poliza.pdf',
      expiresAt: '2027-01-31',
    });
    expect(doc).toMatchObject({
      status: 'PENDING_REVIEW',
      expiresAt: '2027-01-31',
      sizeBytes: 500,
    });
    expect(doc).not.toHaveProperty('fileKey');
  });

  it('no deja subir a un parqueadero de otro aliado (404)', async () => {
    await expect(
      service.createUploadTicket(partner.id, OTHER_LOT, {
        type: 'RUT',
        fileName: 'rut.pdf',
        contentType: 'application/pdf',
        sizeBytes: 10,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza archivos más grandes que el máximo de settings', async () => {
    await expect(
      service.createUploadTicket(partner.id, LOT, {
        type: 'RUT',
        fileName: 'rut.pdf',
        contentType: 'application/pdf',
        sizeBytes: 5000,
      }),
    ).rejects.toThrow(/tamaño máximo/);
  });

  it('rechaza una llave de otro documento o parqueadero', async () => {
    await expect(
      service.submit(partner.id, LOT, {
        type: 'RUT',
        key: `${documentKeyPrefix(OTHER_LOT, 'RUT')}x.pdf`,
        fileName: 'rut.pdf',
      }),
    ).rejects.toThrow(/no corresponde/);
  });

  it('borra y rechaza un archivo subido que no cumple (tipo real distinto)', async () => {
    const key = await upload('RUT', { sizeBytes: 500, contentType: 'text/html' });
    await expect(
      service.submit(partner.id, LOT, { type: 'RUT', key, fileName: 'rut.pdf' }),
    ).rejects.toThrow(/no es válido/);
    expect(storage.deleted).toContain(key);
  });

  it('no acepta una póliza ya vencida', async () => {
    const key = await upload('LIABILITY_POLICY');
    await expect(
      service.submit(partner.id, LOT, {
        type: 'LIABILITY_POLICY',
        key,
        fileName: 'poliza.pdf',
        expiresAt: '2026-05-09',
      }),
    ).rejects.toThrow(/vencido/);
  });

  it('reemplazar un documento lo devuelve a revisión y borra el archivo anterior', async () => {
    const first = await upload('RUT');
    const doc = await service.submit(partner.id, LOT, {
      type: 'RUT',
      key: first,
      fileName: 'rut.pdf',
    });
    await service.review(doc.id, { status: 'APPROVED' });

    const second = await upload('RUT');
    const replaced = await service.submit(partner.id, LOT, {
      type: 'RUT',
      key: second,
      fileName: 'rut2.pdf',
    });
    expect(replaced).toMatchObject({ id: doc.id, status: 'PENDING_REVIEW', fileName: 'rut2.pdf' });
    expect(storage.deleted).toEqual([first]);
  });

  it('el admin rechaza con motivo y se le avisa al aliado', async () => {
    const key = await upload('RUT');
    const doc = await service.submit(partner.id, LOT, { type: 'RUT', key, fileName: 'rut.pdf' });
    const reviewed = await service.review(doc.id, {
      status: 'REJECTED',
      rejectionReason: 'Ilegible',
    });
    expect(reviewed).toMatchObject({ status: 'REJECTED', rejectionReason: 'Ilegible' });
    expect(notifications.documentReviewed).toHaveBeenCalledWith(
      partner,
      expect.objectContaining({ approved: false, reason: 'Ilegible' }),
    );
  });

  it('avisa una sola vez la póliza que vence dentro de 20 días', async () => {
    const key = await upload('LIABILITY_POLICY');
    const doc = await service.submit(partner.id, LOT, {
      type: 'LIABILITY_POLICY',
      key,
      fileName: 'poliza.pdf',
      expiresAt: '2026-05-30',
    });
    await service.review(doc.id, { status: 'APPROVED' });

    await service.checkExpirations(now);
    await service.checkExpirations(now);
    expect(notifications.documentExpiring).toHaveBeenCalledTimes(1);
    expect(lots.revokeVerification).not.toHaveBeenCalled();
  });

  it('al vencer marca el documento, quita el sello "Verificado" y avisa', async () => {
    const key = await upload('LIABILITY_POLICY');
    const doc = await service.submit(partner.id, LOT, {
      type: 'LIABILITY_POLICY',
      key,
      fileName: 'poliza.pdf',
      expiresAt: '2026-05-15',
    });
    await service.review(doc.id, { status: 'APPROVED' });

    // El último día de vigencia (15) todavía cuenta; el 16 ya está vencido.
    await service.checkExpirations(new Date('2026-05-15T23:00:00Z'));
    expect(lots.revokeVerification).not.toHaveBeenCalled();
    await service.checkExpirations(new Date('2026-05-16T15:00:00Z'));
    await service.checkExpirations(new Date('2026-05-17T15:00:00Z'));

    expect(repo.rows[0]?.status).toBe('EXPIRED');
    expect(lots.revokeVerification).toHaveBeenCalledTimes(1);
    expect(lots.revokeVerification).toHaveBeenCalledWith(LOT);
    expect(notifications.documentExpired).toHaveBeenCalledTimes(1);
    await expect(service.review(doc.id, { status: 'APPROVED' })).rejects.toThrow(/venció/);
  });
});
