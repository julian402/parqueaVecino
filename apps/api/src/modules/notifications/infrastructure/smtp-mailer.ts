import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfigService } from '../../../config/app-config.service';
import { Mailer, type EmailMessage } from '../domain/mailer';

/**
 * Correo por SMTP. Sin SMTP_HOST (p. ej. en AWS mientras no haya SES) solo registra en el log
 * el asunto (sin destinatario ni contenido, que son datos personales).
 */
@Injectable()
export class SmtpMailer extends Mailer {
  private readonly logger = new Logger(SmtpMailer.name);
  private readonly transport: Transporter | undefined;
  private readonly from: string | undefined;

  constructor(config: AppConfigService) {
    super();
    const host = config.get('SMTP_HOST');
    // El esquema de entorno exige MAIL_FROM cuando hay SMTP_HOST.
    this.from = config.get('MAIL_FROM');
    if (host) {
      this.transport = createTransport({ host, port: config.get('SMTP_PORT') ?? 25 });
    }
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.transport) {
      this.logger.log({ subject: message.subject }, 'Correo no enviado: SMTP sin configurar');
      return;
    }
    await this.transport.sendMail({ from: this.from, ...message });
  }
}
