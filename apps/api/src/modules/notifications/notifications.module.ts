import { Module } from '@nestjs/common';
import { NotificationsService } from './application/notifications.service';
import { Mailer } from './domain/mailer';
import { SmtpMailer } from './infrastructure/smtp-mailer';

/** Correos transaccionales (avisos de vencimiento, revisión de documentos). */
@Module({
  providers: [NotificationsService, { provide: Mailer, useClass: SmtpMailer }],
  exports: [NotificationsService],
})
export class NotificationsModule {}
