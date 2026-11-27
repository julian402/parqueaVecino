import { z } from 'zod';
import { pageMetaSchema, pageQuerySchema } from './admin';
import { DocumentStatus, DocumentType } from './enums';

/** Formatos aceptados para los documentos de verificación (escaneos o PDF). */
export const DOCUMENT_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type DocumentContentType = (typeof DOCUMENT_CONTENT_TYPES)[number];

/** Documentos que vencen: hay que indicar la fecha de vencimiento al subirlos. */
export const DOCUMENT_TYPES_WITH_EXPIRY: readonly DocumentType[] = [DocumentType.LIABILITY_POLICY];

export function documentRequiresExpiry(type: DocumentType): boolean {
  return DOCUMENT_TYPES_WITH_EXPIRY.includes(type);
}

/** Fecha sin hora (AAAA-MM-DD), interpretada en la zona horaria de la app. */
const dateOnly = z.iso.date();

/** Documento de verificación de un parqueadero (póliza RC, RUT, facturación electrónica). */
export const lotDocumentSchema = z.object({
  id: z.uuid(),
  type: z.enum(DocumentType),
  status: z.enum(DocumentStatus),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  expiresAt: dateOnly.nullable(),
  /** Motivo que escribe el admin al rechazarlo. */
  rejectionReason: z.string().nullable(),
  uploadedAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime().nullable(),
});
export type LotDocument = z.infer<typeof lotDocumentSchema>;

/** Documentos de un parqueadero vistos por su aliado. */
export const partnerLotDocumentsSchema = z.object({
  parkingLotId: z.uuid(),
  /** false si la plataforma no tiene almacenamiento de archivos configurado. */
  uploadsEnabled: z.boolean(),
  /** Tamaño máximo de cada archivo, en bytes. */
  maxFileBytes: z.number().int(),
  /** Días antes del vencimiento en que se avisa por correo. */
  expiryNoticeDays: z.number().int(),
  documents: z.array(lotDocumentSchema),
});
export type PartnerLotDocuments = z.infer<typeof partnerLotDocumentsSchema>;

/** Paso 1 de la subida: el aliado declara el archivo y la API devuelve una URL prefirmada. */
export const documentUploadRequestSchema = z.object({
  type: z.enum(DocumentType),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(DOCUMENT_CONTENT_TYPES),
  sizeBytes: z.number().int().positive(),
});
export type DocumentUploadRequest = z.infer<typeof documentUploadRequestSchema>;

/** URL prefirmada (PUT) para subir el archivo directo al almacenamiento, sin pasar por la API. */
export const documentUploadTicketSchema = z.object({
  url: z.url(),
  /** Encabezados que el navegador debe enviar tal cual en el PUT (forman parte de la firma). */
  headers: z.record(z.string(), z.string()),
  /** Identificador del archivo subido: se envía en el paso 2. */
  key: z.string(),
  expiresAt: z.iso.datetime(),
});
export type DocumentUploadTicket = z.infer<typeof documentUploadTicketSchema>;

/** Paso 2: con el archivo ya subido, se registra el documento y queda pendiente de revisión. */
export const documentSubmitSchema = z
  .object({
    type: z.enum(DocumentType),
    key: z.string().min(1).max(300),
    fileName: z.string().trim().min(1).max(200),
    expiresAt: dateOnly.optional(),
  })
  .refine((input) => !documentRequiresExpiry(input.type) || Boolean(input.expiresAt), {
    message: 'Indica la fecha de vencimiento',
    path: ['expiresAt'],
  });
export type DocumentSubmitInput = z.infer<typeof documentSubmitSchema>;

/** Enlace temporal para ver o descargar un archivo privado. */
export const fileLinkSchema = z.object({ url: z.url() });
export type FileLink = z.infer<typeof fileLinkSchema>;

// ---------- Panel del admin ----------

export const adminDocumentSchema = lotDocumentSchema.extend({
  parkingLot: z.object({ id: z.uuid(), name: z.string() }),
  partner: z.object({ id: z.uuid(), fullName: z.string(), email: z.string() }),
});
export type AdminDocument = z.infer<typeof adminDocumentSchema>;

export const adminDocumentListQuerySchema = pageQuerySchema.extend({
  status: z.enum(DocumentStatus).optional(),
});
export type AdminDocumentListQuery = z.infer<typeof adminDocumentListQuerySchema>;

export const adminDocumentPageSchema = pageMetaSchema.extend({
  items: z.array(adminDocumentSchema),
});
export type AdminDocumentPage = z.infer<typeof adminDocumentPageSchema>;

/** Aprobar o rechazar un documento (rechazar exige el motivo, que ve el aliado). */
export const adminDocumentReviewSchema = z
  .object({
    status: z.enum([DocumentStatus.APPROVED, DocumentStatus.REJECTED]),
    rejectionReason: z.string().trim().min(3).max(300).optional(),
  })
  .refine((input) => input.status !== DocumentStatus.REJECTED || Boolean(input.rejectionReason), {
    message: 'Escribe el motivo del rechazo',
    path: ['rejectionReason'],
  });
export type AdminDocumentReviewInput = z.infer<typeof adminDocumentReviewSchema>;
