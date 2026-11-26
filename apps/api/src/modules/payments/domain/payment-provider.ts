/**
 * Puerto de la pasarela de pagos. El dominio solo conoce esta interfaz: hoy la implementa
 * Stripe (modo test) y mañana podría ser Wompi sin tocar los casos de uso.
 */
export type ProviderPaymentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

export interface ProviderPayment {
  /** Id del cobro en la pasarela (PaymentIntent). */
  id: string;
  status: ProviderPaymentStatus;
  /** Secreto que usa el navegador para confirmar el pago (Payment Element). */
  clientSecret: string | null;
}

export interface CreatePaymentCommand {
  amountMinor: number;
  currency: string;
  /** Comisión de la plataforma (application fee cuando el aliado tenga cuenta conectada). */
  commissionMinor: number;
  description: string;
  /** Evita cobros duplicados si la misma petición se repite. */
  idempotencyKey: string;
  metadata: Record<string, string>;
}

export type PaymentEvent =
  | { type: 'payment.succeeded'; paymentId: string }
  | { type: 'payment.failed'; paymentId: string }
  | { type: 'payment.refunded'; paymentId: string };

export abstract class PaymentProvider {
  abstract readonly name: string;
  /** false si no hay llave configurada: la web muestra que los pagos están deshabilitados. */
  abstract get enabled(): boolean;
  abstract createPayment(command: CreatePaymentCommand): Promise<ProviderPayment>;
  abstract getPayment(id: string): Promise<ProviderPayment>;
  abstract cancelPayment(id: string): Promise<void>;
  abstract refundPayment(id: string, idempotencyKey: string): Promise<void>;
  /**
   * Verifica la firma del webhook y lo traduce a un evento del dominio.
   * Lanza si la firma es inválida; devuelve null para eventos que no interesan.
   */
  abstract parseWebhook(rawBody: Buffer, signature: string): PaymentEvent | null;
}
