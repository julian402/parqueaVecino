import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import {
  DOCUMENT_CONTENT_TYPES,
  DocumentStatus,
  documentRequiresExpiry,
  type AdminDocument,
  type AdminDocumentListQuery,
  type AdminDocumentPage,
  type AdminDocumentReviewInput,
  type DocumentSubmitInput,
  type DocumentType,
  type DocumentUploadRequest,
  type DocumentUploadTicket,
  type FileLink,
  type LotDocument,
  type PartnerLotDocuments,
} from '@parqueavecino/contracts';
import { addDaysToDate, dateInTimeZone } from '@parqueavecino/utils';
import { JobScheduler } from '../../../common/jobs/job-scheduler';
import { FileStorage } from '../../../common/storage/file-storage';
import { AppConfigService } from '../../../config/app-config.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { ParkingLotsService } from '../../parking-lots/application/parking-lots.service';
import { SettingsService } from '../../settings/application/settings.service';
import {
  DocumentsRepository,
  type DocumentRecord,
  type DocumentWithContext,
} from '../domain/documents.repository';

const NOT_FOUND = 'Documento no encontrado';
const EXTENSIONS: Record<(typeof DOCUMENT_CONTENT_TYPES)[number], string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/** Carpeta de los archivos de un documento: la llave enviada por el aliado debe estar dentro. */
export function documentKeyPrefix(parkingLotId: string, type: DocumentType): string {
  return `documents/${parkingLotId}/${type}/`;
}

function toPublic({
  parkingLotId: _l,
  fileKey: _k,
  expiryNoticeSentAt: _n,
  ...doc
}: DocumentRecord): LotDocument {
  return doc;
}

function toAdmin(doc: DocumentWithContext): AdminDocument {
  return { ...toPublic(doc), parkingLot: doc.parkingLot, partner: doc.partner };
}

/**
 * Verificación de aliados (atributo N2): documentos por parqueadero en S3 con URL prefirmada,
 * revisión del admin, avisos de vencimiento y pérdida del sello "Verificado" al vencer.
 */
@Injectable()
export class VerificationService implements OnModuleInit {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly repository: DocumentsRepository,
    private readonly storage: FileStorage,
    private readonly lots: ParkingLotsService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobScheduler,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    this.jobs.register({
      name: 'verification.expirations',
      everySeconds: this.config.get('EXPIRY_CHECK_INTERVAL_SECONDS'),
      run: () => this.checkExpirations(),
    });
  }

  // ---------- Aliado ----------

  async listForPartner(partnerId: string, parkingLotId: string): Promise<PartnerLotDocuments> {
    await this.lots.getForPartner(partnerId, parkingLotId);
    const [documents, maxFileBytes, expiryNoticeDays] = await Promise.all([
      this.repository.listByLot(parkingLotId),
      this.settings.get('verification.maxFileBytes'),
      this.settings.get('verification.expiryNoticeDays'),
    ]);
    return {
      parkingLotId,
      uploadsEnabled: this.storage.enabled,
      maxFileBytes,
      expiryNoticeDays,
      documents: documents.map(toPublic),
    };
  }

  /** Paso 1: URL prefirmada para subir el archivo directo a S3 (no pasa por la API). */
  async createUploadTicket(
    partnerId: string,
    parkingLotId: string,
    input: DocumentUploadRequest,
  ): Promise<DocumentUploadTicket> {
    await this.lots.getForPartner(partnerId, parkingLotId);
    await this.assertSize(input.sizeBytes);
    const key = `${documentKeyPrefix(parkingLotId, input.type)}${randomUUID()}${EXTENSIONS[input.contentType]}`;
    const ticket = await this.storage.createUploadTicket({
      key,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    });
    return {
      url: ticket.url,
      headers: ticket.headers,
      key,
      expiresAt: ticket.expiresAt.toISOString(),
    };
  }

  /** Paso 2: con el archivo ya en S3, se registra y queda pendiente de revisión. */
  async submit(
    partnerId: string,
    parkingLotId: string,
    input: DocumentSubmitInput,
  ): Promise<LotDocument> {
    await this.lots.getForPartner(partnerId, parkingLotId);
    if (!input.key.startsWith(documentKeyPrefix(parkingLotId, input.type))) {
      throw new BadRequestException('El archivo no corresponde a este documento');
    }
    const expiresAt = documentRequiresExpiry(input.type) ? (input.expiresAt ?? null) : null;
    if (expiresAt && expiresAt < this.today()) {
      throw new BadRequestException('El documento ya está vencido: sube uno vigente');
    }

    const stored = await this.storage.head(input.key);
    if (!stored) throw new BadRequestException('No encontramos el archivo: vuelve a subirlo');
    const maxBytes = await this.settings.get('verification.maxFileBytes');
    const allowed: readonly string[] = DOCUMENT_CONTENT_TYPES;
    if (
      stored.sizeBytes > maxBytes ||
      !stored.contentType ||
      !allowed.includes(stored.contentType)
    ) {
      await this.storage.delete(input.key);
      throw new BadRequestException('El archivo no es válido (formato o tamaño)');
    }

    const previous = await this.repository.findByLotAndType(parkingLotId, input.type);
    const saved = await this.repository.upsert({
      parkingLotId,
      type: input.type,
      fileKey: input.key,
      fileName: input.fileName,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
      expiresAt,
    });
    if (previous && previous.fileKey !== input.key) {
      // El archivo reemplazado ya no se usa; si falla el borrado, queda huérfano pero privado.
      await this.storage.delete(previous.fileKey).catch((error: unknown) => {
        this.logger.warn({ err: error }, 'No se pudo borrar el archivo reemplazado');
      });
    }
    return toPublic(saved);
  }

  async partnerFileLink(partnerId: string, parkingLotId: string, id: string): Promise<FileLink> {
    await this.lots.getForPartner(partnerId, parkingLotId);
    const doc = await this.repository.findById(id);
    if (doc?.parkingLotId !== parkingLotId) throw new NotFoundException(NOT_FOUND);
    return { url: await this.storage.downloadUrl(doc.fileKey, doc.fileName) };
  }

  // ---------- Admin ----------

  async listForAdmin(query: AdminDocumentListQuery): Promise<AdminDocumentPage> {
    const { items, total } = await this.repository.listForAdmin(query);
    return { items: items.map(toAdmin), total, page: query.page, pageSize: query.pageSize };
  }

  async review(id: string, input: AdminDocumentReviewInput): Promise<AdminDocument> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundException(NOT_FOUND);
    if (doc.status === DocumentStatus.EXPIRED) {
      throw new ConflictException('El documento venció: el aliado debe subir uno nuevo');
    }
    if (input.status === DocumentStatus.APPROVED && doc.expiresAt && doc.expiresAt < this.today()) {
      throw new ConflictException('No se puede aprobar un documento vencido');
    }
    const reason =
      input.status === DocumentStatus.REJECTED ? (input.rejectionReason ?? null) : null;
    const reviewed = await this.repository.review(id, input.status, reason);
    if (doc.status !== input.status) {
      await this.notifications.documentReviewed(reviewed.partner, {
        parkingLotName: reviewed.parkingLot.name,
        type: reviewed.type,
        approved: input.status === DocumentStatus.APPROVED,
        reason,
      });
    }
    return toAdmin(reviewed);
  }

  async adminFileLink(id: string): Promise<FileLink> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundException(NOT_FOUND);
    return { url: await this.storage.downloadUrl(doc.fileKey, doc.fileName) };
  }

  // ---------- Job de vencimientos ----------

  /**
   * Avisa los documentos que vencen dentro de `verification.expiryNoticeDays` y marca vencidos
   * los que pasaron su fecha (el parqueadero pierde el sello). Idempotente.
   */
  async checkExpirations(now = new Date()): Promise<void> {
    const today = this.today(now);
    for (const doc of await this.repository.findExpired(today)) {
      if (!(await this.repository.markExpired(doc.id))) continue;
      await this.lots.revokeVerification(doc.parkingLotId);
      await this.notifications.documentExpired(doc.partner, {
        parkingLotName: doc.parkingLot.name,
        type: doc.type,
      });
    }

    const noticeDays = await this.settings.get('verification.expiryNoticeDays');
    for (const doc of await this.repository.findExpiringWithoutNotice(
      addDaysToDate(today, noticeDays),
    )) {
      if (!doc.expiresAt) continue;
      const sent = await this.notifications.documentExpiring(doc.partner, {
        parkingLotName: doc.parkingLot.name,
        type: doc.type,
        expiresAt: new Date(`${doc.expiresAt}T00:00:00Z`),
      });
      // Si el correo falla, se reintenta en la siguiente ejecución.
      if (sent) await this.repository.markNoticeSent(doc.id, now);
    }
  }

  private async assertSize(sizeBytes: number): Promise<void> {
    const maxBytes = await this.settings.get('verification.maxFileBytes');
    if (sizeBytes > maxBytes) {
      throw new BadRequestException({
        message: 'El archivo supera el tamaño máximo permitido',
        maxFileBytes: maxBytes,
      });
    }
  }

  /** Fecha de hoy (AAAA-MM-DD) en la zona de la app. */
  private today(now = new Date()): string {
    return dateInTimeZone(now, this.config.get('APP_TIMEZONE'));
  }
}
