import { Injectable, Logger } from '@nestjs/common';
import type { DocumentType } from '@parqueavecino/contracts';
import { formatInTimeZone } from '@parqueavecino/utils';
import { AppConfigService } from '../../../config/app-config.service';
import { Mailer, type EmailMessage } from '../domain/mailer';
import { buildEmail, DOCUMENT_LABELS } from './email-templates';

export interface Recipient {
  email: string;
  fullName: string;
}

/** Rutas de la web a las que llevan los correos (deben coincidir con apps/web/src/lib/routes.ts). */
const WEB_PATHS = {
  driverOverview: '/mi-cuenta',
  partnerDocuments: '/aliados/documentos',
} as const;

/**
 * Correos transaccionales. Un correo que falla no rompe el caso de uso que lo dispara:
 * se registra el error y el job lo vuelve a intentar en su siguiente ejecución si aplica.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly mailer: Mailer,
    private readonly config: AppConfigService,
  ) {}

  bookingExpiring(
    to: Recipient,
    input: { parkingLotName: string; plate: string; endsAt: Date },
  ): Promise<boolean> {
    return this.deliver(
      buildEmail({
        to: to.email,
        subject: `Tu mensualidad en ${input.parkingLotName} termina pronto`,
        greetingName: firstName(to.fullName),
        paragraphs: [
          `Tu mensualidad en ${input.parkingLotName} (placa ${input.plate}) termina el ${this.date(input.endsAt)}.`,
          'Renuévala para conservar tu cupo: la nueva empieza justo cuando termine la actual.',
        ],
        action: this.link('Renovar mi mensualidad', WEB_PATHS.driverOverview),
      }),
    );
  }

  documentExpiring(
    to: Recipient,
    input: { parkingLotName: string; type: DocumentType; expiresAt: Date },
  ): Promise<boolean> {
    const label = DOCUMENT_LABELS[input.type];
    return this.deliver(
      buildEmail({
        to: to.email,
        subject: `${label} de ${input.parkingLotName} vence pronto`,
        greetingName: firstName(to.fullName),
        paragraphs: [
          `${label} de ${input.parkingLotName} vence el ${this.date(input.expiresAt, true)}.`,
          'Sube el documento renovado para conservar el sello "Verificado".',
        ],
        action: this.link('Subir documento', WEB_PATHS.partnerDocuments),
      }),
    );
  }

  documentExpired(
    to: Recipient,
    input: { parkingLotName: string; type: DocumentType },
  ): Promise<boolean> {
    const label = DOCUMENT_LABELS[input.type];
    return this.deliver(
      buildEmail({
        to: to.email,
        subject: `${label} de ${input.parkingLotName} venció`,
        greetingName: firstName(to.fullName),
        paragraphs: [
          `${label} de ${input.parkingLotName} venció y el parqueadero perdió el sello "Verificado".`,
          'Sube el documento vigente para que lo revisemos de nuevo.',
        ],
        action: this.link('Subir documento', WEB_PATHS.partnerDocuments),
      }),
    );
  }

  documentReviewed(
    to: Recipient,
    input: {
      parkingLotName: string;
      type: DocumentType;
      approved: boolean;
      reason: string | null;
    },
  ): Promise<boolean> {
    const label = DOCUMENT_LABELS[input.type];
    return this.deliver(
      buildEmail({
        to: to.email,
        subject: input.approved
          ? `Aprobamos ${label} de ${input.parkingLotName}`
          : `Revisa ${label} de ${input.parkingLotName}`,
        greetingName: firstName(to.fullName),
        paragraphs: input.approved
          ? [`Revisamos y aprobamos ${label} de ${input.parkingLotName}.`]
          : [
              `No pudimos aprobar ${label} de ${input.parkingLotName}.`,
              `Motivo: ${input.reason ?? '—'}`,
              'Corrige el documento y súbelo de nuevo.',
            ],
        action: this.link('Ver mis documentos', WEB_PATHS.partnerDocuments),
      }),
    );
  }

  /** Envía y devuelve si se pudo (el llamador decide si marca el aviso como enviado). */
  private async deliver(message: EmailMessage): Promise<boolean> {
    try {
      await this.mailer.send(message);
      return true;
    } catch (error) {
      this.logger.error({ err: error, subject: message.subject }, 'No se pudo enviar el correo');
      return false;
    }
  }

  private link(label: string, path: string): { label: string; url: string } | undefined {
    const base = this.config.get('WEB_URL');
    return base ? { label, url: new URL(path, base).toString() } : undefined;
  }

  /** Fecha legible en la zona de la app. `dateOnly`: fechas sin hora (guardadas a medianoche UTC). */
  private date(value: Date, dateOnly = false): string {
    return formatInTimeZone(value, {
      locale: this.config.get('APP_LOCALE'),
      timeZone: dateOnly ? 'UTC' : this.config.get('APP_TIMEZONE'),
      dateStyle: 'long',
    });
  }
}

function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}
