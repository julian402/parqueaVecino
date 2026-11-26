/**
 * Exporta el contrato OpenAPI a `apps/api/openapi.json` sin levantar el servidor ni la BD.
 * La web genera su cliente tipado a partir de ese archivo (Orval).
 * Uso: pnpm --filter @parqueavecino/api openapi
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createOpenApiDocument } from './bootstrap';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  const document = createOpenApiDocument(app);
  const output = join(__dirname, '..', 'openapi.json');
  writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  process.stdout.write(`OpenAPI exportado en ${output}\n`);
}

void main();
