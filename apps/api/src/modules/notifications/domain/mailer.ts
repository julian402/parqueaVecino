export interface EmailMessage {
  to: string;
  subject: string;
  /** Texto plano (todo cliente de correo lo muestra). */
  text: string;
  html: string;
}

/** Puerto de envío de correo: SMTP (Mailpit en local) o solo log si no hay servidor. SES después. */
export abstract class Mailer {
  abstract send(message: EmailMessage): Promise<void>;
}
