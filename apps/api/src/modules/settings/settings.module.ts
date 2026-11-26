import { Module } from '@nestjs/common';
import { SettingsService } from './application/settings.service';
import { SettingsRepository } from './domain/settings.repository';
import { PrismaSettingsRepository } from './infrastructure/prisma-settings.repository';
import { SettingsController } from './presentation/settings.controller';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, { provide: SettingsRepository, useClass: PrismaSettingsRepository }],
  exports: [SettingsService],
})
export class SettingsModule {}
