import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * Cliente de Prisma compartido. Solo lo usan los repositorios en `modules/<x>/infrastructure`;
 * la capa `application` nunca lo importa directamente.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({ adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL') }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
