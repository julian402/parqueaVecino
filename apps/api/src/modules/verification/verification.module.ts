import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParkingLotsModule } from '../parking-lots/parking-lots.module';
import { SettingsModule } from '../settings/settings.module';
import { VerificationService } from './application/verification.service';
import { DocumentsRepository } from './domain/documents.repository';
import { PrismaDocumentsRepository } from './infrastructure/prisma-documents.repository';
import {
  AdminDocumentsController,
  PartnerDocumentsController,
} from './presentation/documents.controller';

@Module({
  imports: [SettingsModule, ParkingLotsModule, NotificationsModule],
  controllers: [PartnerDocumentsController, AdminDocumentsController],
  providers: [
    VerificationService,
    { provide: DocumentsRepository, useClass: PrismaDocumentsRepository },
  ],
})
export class VerificationModule {}
