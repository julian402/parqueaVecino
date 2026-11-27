import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { FileStorage, type StoredFile, type UploadTicket } from './file-storage';

/** Nombre seguro para Content-Disposition (sin comillas ni saltos de línea). */
export function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\w.\- ]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Adaptador S3. En AWS usa las credenciales del rol de la tarea (sin llaves); en local apunta a
 * S3Mock con S3_ENDPOINT y estilo de ruta.
 */
@Injectable()
export class S3FileStorage extends FileStorage {
  readonly enabled: boolean;
  private readonly client: S3Client | undefined;
  private readonly bucket: string | undefined;
  private readonly ttlSeconds: number;

  constructor(config: AppConfigService) {
    super();
    this.bucket = config.get('S3_BUCKET_UPLOADS');
    this.ttlSeconds = config.get('S3_PRESIGN_TTL_SECONDS');
    this.enabled = Boolean(this.bucket);
    if (!this.enabled) return;
    const accessKeyId = config.get('S3_ACCESS_KEY_ID');
    const secretAccessKey = config.get('S3_SECRET_ACCESS_KEY');
    this.client = new S3Client({
      region: config.get('S3_REGION'),
      endpoint: config.get('S3_ENDPOINT'),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE'),
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }

  async createUploadTicket(input: {
    key: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<UploadTicket> {
    const { client, bucket } = this.require();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
    });
    // Tipo y tamaño quedan dentro de la firma: S3 rechaza un archivo distinto al declarado.
    const url = await getSignedUrl(client, command, {
      expiresIn: this.ttlSeconds,
      signableHeaders: new Set(['content-type', 'content-length']),
    });
    return {
      url,
      headers: { 'Content-Type': input.contentType },
      expiresAt: new Date(Date.now() + this.ttlSeconds * 1000),
    };
  }

  async head(key: string): Promise<StoredFile | null> {
    const { client, bucket } = this.require();
    try {
      const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { sizeBytes: result.ContentLength ?? 0, contentType: result.ContentType ?? null };
    } catch (error) {
      if (error instanceof NotFound || (error as { name?: string }).name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  async downloadUrl(key: string, fileName: string): Promise<string> {
    const { client, bucket } = this.require();
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: contentDisposition(fileName),
      }),
      { expiresIn: this.ttlSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = this.require();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  private require(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException('La carga de archivos no está disponible');
    }
    return { client: this.client, bucket: this.bucket };
  }
}
