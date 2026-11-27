import { Global, Module } from '@nestjs/common';
import { FileStorage } from './file-storage';
import { S3FileStorage } from './s3-file-storage';

/** Archivos privados (puerto FileStorage). Global: lo usan varios módulos (documentos, fotos). */
@Global()
@Module({
  providers: [{ provide: FileStorage, useClass: S3FileStorage }],
  exports: [FileStorage],
})
export class StorageModule {}
