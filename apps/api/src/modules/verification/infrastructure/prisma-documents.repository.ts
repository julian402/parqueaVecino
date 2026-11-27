import { Injectable } from '@nestjs/common';
import {
  DocumentStatus,
  type AdminDocumentListQuery,
  type DocumentType,
} from '@parqueavecino/contracts';
import { PrismaService } from '../../../common/database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import {
  DocumentsRepository,
  type DocumentRecord,
  type DocumentUpload,
  type DocumentWithContext,
} from '../domain/documents.repository';

const contextInclude = {
  parkingLot: {
    select: {
      id: true,
      name: true,
      partner: { select: { id: true, fullName: true, email: true } },
    },
  },
} satisfies Prisma.ParkingLotDocumentInclude;

type DocumentRow = Prisma.ParkingLotDocumentGetPayload<object>;
type DocumentContextRow = Prisma.ParkingLotDocumentGetPayload<{ include: typeof contextInclude }>;

/** Columna DATE ↔ AAAA-MM-DD (Prisma la entrega como medianoche UTC). */
const toDateOnly = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;
const fromDateOnly = (value: string | null): Date | null =>
  value ? new Date(`${value}T00:00:00Z`) : null;

function toRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    parkingLotId: row.parkingLotId,
    type: row.type,
    status: row.status,
    fileKey: row.fileKey,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    expiresAt: toDateOnly(row.expiresAt),
    rejectionReason: row.rejectionReason,
    uploadedAt: row.uploadedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    expiryNoticeSentAt: row.expiryNoticeSentAt,
  };
}

function toContext(row: DocumentContextRow): DocumentWithContext {
  const { partner, ...lot } = row.parkingLot;
  return { ...toRecord(row), parkingLot: lot, partner };
}

/** Estados que todavía cuentan como vigentes (y por tanto pueden vencer). */
const LIVE_STATUSES = [DocumentStatus.APPROVED, DocumentStatus.PENDING_REVIEW];

@Injectable()
export class PrismaDocumentsRepository extends DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listByLot(parkingLotId: string): Promise<DocumentRecord[]> {
    const rows = await this.prisma.parkingLotDocument.findMany({
      where: { parkingLotId },
      orderBy: { type: 'asc' },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<DocumentWithContext | null> {
    const row = await this.prisma.parkingLotDocument.findUnique({
      where: { id },
      include: contextInclude,
    });
    return row ? toContext(row) : null;
  }

  async findByLotAndType(parkingLotId: string, type: DocumentType): Promise<DocumentRecord | null> {
    const row = await this.prisma.parkingLotDocument.findUnique({
      where: { parkingLotId_type: { parkingLotId, type } },
    });
    return row ? toRecord(row) : null;
  }

  async upsert(data: DocumentUpload): Promise<DocumentRecord> {
    const file = {
      fileKey: data.fileKey,
      fileName: data.fileName,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
      expiresAt: fromDateOnly(data.expiresAt),
    };
    const row = await this.prisma.parkingLotDocument.upsert({
      where: { parkingLotId_type: { parkingLotId: data.parkingLotId, type: data.type } },
      create: { parkingLotId: data.parkingLotId, type: data.type, ...file },
      update: {
        ...file,
        status: DocumentStatus.PENDING_REVIEW,
        rejectionReason: null,
        reviewedAt: null,
        expiryNoticeSentAt: null,
        uploadedAt: new Date(),
      },
    });
    return toRecord(row);
  }

  async review(
    id: string,
    status: DocumentStatus,
    rejectionReason: string | null,
  ): Promise<DocumentWithContext> {
    const row = await this.prisma.parkingLotDocument.update({
      where: { id },
      data: { status, rejectionReason, reviewedAt: new Date() },
      include: contextInclude,
    });
    return toContext(row);
  }

  async listForAdmin(
    query: AdminDocumentListQuery,
  ): Promise<{ items: DocumentWithContext[]; total: number }> {
    const where: Prisma.ParkingLotDocumentWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.q && {
        parkingLot: {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { partner: { fullName: { contains: query.q, mode: 'insensitive' } } },
            { partner: { email: { contains: query.q, mode: 'insensitive' } } },
          ],
        },
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.parkingLotDocument.findMany({
        where,
        include: contextInclude,
        // Los más antiguos primero: es una cola de revisión.
        orderBy: { uploadedAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.parkingLotDocument.count({ where }),
    ]);
    return { items: rows.map(toContext), total };
  }

  async findExpiringWithoutNotice(lastDay: string): Promise<DocumentWithContext[]> {
    const rows = await this.prisma.parkingLotDocument.findMany({
      where: {
        status: DocumentStatus.APPROVED,
        expiryNoticeSentAt: null,
        expiresAt: { lte: fromDateOnly(lastDay) ?? undefined },
      },
      include: contextInclude,
    });
    return rows.map(toContext);
  }

  async findExpired(today: string): Promise<DocumentWithContext[]> {
    const rows = await this.prisma.parkingLotDocument.findMany({
      where: { status: { in: LIVE_STATUSES }, expiresAt: { lt: fromDateOnly(today) ?? undefined } },
      include: contextInclude,
    });
    return rows.map(toContext);
  }

  async markNoticeSent(id: string, at: Date): Promise<void> {
    await this.prisma.parkingLotDocument.update({
      where: { id },
      data: { expiryNoticeSentAt: at },
    });
  }

  async markExpired(id: string): Promise<boolean> {
    const { count } = await this.prisma.parkingLotDocument.updateMany({
      where: { id, status: { in: LIVE_STATUSES } },
      data: { status: DocumentStatus.EXPIRED },
    });
    return count === 1;
  }
}
