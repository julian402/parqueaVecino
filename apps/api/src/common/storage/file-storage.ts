/** Subida directa del navegador al almacenamiento con una URL prefirmada (PUT). */
export interface UploadTicket {
  url: string;
  /** Encabezados firmados: el navegador debe enviarlos tal cual. */
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StoredFile {
  sizeBytes: number;
  contentType: string | null;
}

/**
 * Puerto de archivos privados (S3 en AWS, S3Mock en local). Los archivos nunca son públicos:
 * se suben y se leen con URLs prefirmadas de corta duración.
 */
export abstract class FileStorage {
  /** false si no hay almacenamiento configurado (las subidas responden 503). */
  abstract readonly enabled: boolean;
  /** URL para subir exactamente un archivo de ese tipo y tamaño en `key`. */
  abstract createUploadTicket(input: {
    key: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<UploadTicket>;
  /** Metadatos del archivo subido, o null si no existe. */
  abstract head(key: string): Promise<StoredFile | null>;
  /** URL temporal para ver el archivo (con su nombre original al descargarlo). */
  abstract downloadUrl(key: string, fileName: string): Promise<string>;
  abstract delete(key: string): Promise<void>;
}
