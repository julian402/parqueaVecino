import { readFileSync } from 'node:fs';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaClient } from '../../generated/prisma/client';

/** Parámetros SSL de la URL que se ignoran: el SSL se configura con DATABASE_SSL. */
const URL_SSL_PARAMS = ['sslmode', 'sslrootcert', 'sslaccept', 'sslcert', 'sslkey'];

export interface DatabaseConnection {
  url: string;
  sslMode: 'disable' | 'require' | 'verify-full';
  caFile?: string;
}

/** Configuración del pool de `pg`. La usan la API y el seed. */
export function buildPoolConfig({
  url: rawUrl,
  sslMode: mode,
  caFile,
}: DatabaseConnection): PoolConfig {
  const url = new URL(rawUrl);
  URL_SSL_PARAMS.forEach((param) => url.searchParams.delete(param));

  const ssl =
    mode === 'disable'
      ? false
      : mode === 'require'
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true, ca: readFileSync(caFile ?? '', 'utf8') };

  return { connectionString: url.toString(), ssl };
}

/**
 * Cliente de Prisma compartido. Solo lo usan los repositorios en `modules/<x>/infrastructure`;
 * la capa `application` nunca lo importa directamente.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({
      adapter: new PrismaPg(
        buildPoolConfig({
          url: config.get('DATABASE_URL'),
          sslMode: config.get('DATABASE_SSL'),
          caFile: config.get('DATABASE_SSL_CA_FILE'),
        }),
      ),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
