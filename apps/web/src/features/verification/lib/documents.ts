import {
  DOCUMENT_CONTENT_TYPES,
  type DocumentContentType,
  type DocumentType,
  type LotDocument,
} from '@parqueavecino/contracts';
import {
  partnerDocumentsSubmit,
  partnerDocumentsUploadUrl,
} from '@/lib/api/generated/partner/partner';

/** El PUT directo a S3 falló (red, URL vencida o el archivo no coincide con lo declarado). */
export class StorageUploadError extends Error {}

export function isDocumentContentType(type: string): type is DocumentContentType {
  return (DOCUMENT_CONTENT_TYPES as readonly string[]).includes(type);
}

/**
 * Sube un documento en dos pasos: la API entrega una URL prefirmada, el navegador sube el archivo
 * directo a S3 (sin pasar por la API) y luego se registra el documento para revisión.
 */
export async function uploadDocument(input: {
  parkingLotId: string;
  type: DocumentType;
  file: File;
  contentType: DocumentContentType;
  expiresAt?: string;
}): Promise<LotDocument> {
  const ticket = await partnerDocumentsUploadUrl(input.parkingLotId, {
    type: input.type,
    fileName: input.file.name,
    contentType: input.contentType,
    sizeBytes: input.file.size,
  });
  let response: Response;
  try {
    // Llamada al almacenamiento (S3), no a la API: por eso no usa el cliente generado.
    response = await fetch(ticket.url, {
      method: 'PUT',
      headers: ticket.headers,
      body: input.file,
    });
  } catch {
    throw new StorageUploadError();
  }
  if (!response.ok) throw new StorageUploadError();
  return partnerDocumentsSubmit(input.parkingLotId, {
    type: input.type,
    key: ticket.key,
    fileName: input.file.name,
    expiresAt: input.expiresAt,
  });
}

/**
 * Abre un archivo privado en otra pestaña. La pestaña se abre antes de pedir la URL firmada
 * (si se abriera después del `await`, el navegador la bloquearía como ventana emergente).
 */
export async function openSignedFile(getLink: () => Promise<{ url: string }>): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const { url } = await getLink();
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (error) {
    tab?.close();
    throw error;
  }
}
