import type {
  AdminDocument,
  AdminDocumentListQuery,
  DocumentStatus,
  DocumentType,
  LotDocument,
} from '@parqueavecino/contracts';

/** Documento con los datos internos que no se exponen (llave del archivo, aviso enviado). */
export interface DocumentRecord extends LotDocument {
  parkingLotId: string;
  fileKey: string;
  expiryNoticeSentAt: Date | null;
}

/** Documento con su parqueadero y aliado: para el panel del admin y los avisos por correo. */
export type DocumentWithContext = DocumentRecord & Pick<AdminDocument, 'parkingLot' | 'partner'>;

export interface DocumentUpload {
  parkingLotId: string;
  type: DocumentType;
  fileKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** Fecha calendario AAAA-MM-DD, o null si el documento no vence. */
  expiresAt: string | null;
}

export abstract class DocumentsRepository {
  abstract listByLot(parkingLotId: string): Promise<DocumentRecord[]>;
  abstract findById(id: string): Promise<DocumentWithContext | null>;
  abstract findByLotAndType(
    parkingLotId: string,
    type: DocumentType,
  ): Promise<DocumentRecord | null>;
  /** Crea o reemplaza el documento de ese tipo: vuelve a revisión y reinicia el aviso. */
  abstract upsert(data: DocumentUpload): Promise<DocumentRecord>;
  abstract review(
    id: string,
    status: DocumentStatus,
    rejectionReason: string | null,
  ): Promise<DocumentWithContext>;
  abstract listForAdmin(
    query: AdminDocumentListQuery,
  ): Promise<{ items: DocumentWithContext[]; total: number }>;
  /** Aprobados que vencen hasta `lastDay` (inclusive) y aún no tienen aviso. */
  abstract findExpiringWithoutNotice(lastDay: string): Promise<DocumentWithContext[]>;
  /** Aprobados o en revisión cuyo último día de vigencia fue antes de `today`. */
  abstract findExpired(today: string): Promise<DocumentWithContext[]>;
  abstract markNoticeSent(id: string, at: Date): Promise<void>;
  /** Marca vencido solo si sigue aprobado o en revisión (evita carreras). */
  abstract markExpired(id: string): Promise<boolean>;
}
