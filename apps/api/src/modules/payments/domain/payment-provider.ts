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
  /** Comisión de la plataforma: application fee cuando hay cuenta de destino. */
  commissionMinor: number;
  /**
   * Cuenta conectada del aliado que recibe el pago menos la comisión (cargo con destino).
   * Sin ella el cobro queda en la cuenta de la plataforma y la comisión solo se registra.
   */
  destinationAccountId?: string;
  description: string;
  /** Evita cobros duplicados si la misma petición se repite. */
  idempotencyKey: string;
  metadata: Record<string, string>;
}

/** Estado de la cuenta conectada para recibir transferencias. */
export type ProviderPayoutStatus = 'active' | 'pending' | 'action_required';

export interface CreatePayoutAccountCommand {
  email: string;
  displayName: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
}

export interface OnboardingUrls {
  /** A dónde vuelve el aliado al terminar el onboarding. */
  returnUrl: string;
  /** A dónde va si el enlace venció o ya se usó (debe pedir uno nuevo). */
  refreshUrl: string;
}

export interface RefundOptions {
  /** Cargo con destino: también revierte la transferencia al aliado y devuelve la comisión. */
  reverseTransfer: boolean;
}

export type PaymentEvent =
  | { type: 'payment.succeeded'; paymentId: string }
  /** Tarjeta rechazada: el mismo cobro se puede reintentar desde el checkout. */
  | { type: 'payment.declined'; paymentId: string }
  /** Cobro anulado: ya no se puede pagar. */
  | { type: 'payment.failed'; paymentId: string }
  | { type: 'payment.refunded'; paymentId: string };

export abstract class PaymentProvider {
  abstract readonly name: string;
  /** false si no hay llave configurada: la web muestra que los pagos están deshabilitados. */
  abstract get enabled(): boolean;
  abstract createPayment(command: CreatePaymentCommand): Promise<ProviderPayment>;
  abstract getPayment(id: string): Promise<ProviderPayment>;
  abstract cancelPayment(id: string): Promise<void>;
  abstract refundPayment(id: string, idempotencyKey: string, options: RefundOptions): Promise<void>;
  /** Crea la cuenta conectada del aliado (marketplace: recibe transferencias). Devuelve su id. */
  abstract createPayoutAccount(command: CreatePayoutAccountCommand): Promise<string>;
  abstract getPayoutStatus(accountId: string): Promise<ProviderPayoutStatus>;
  /** Enlace de un solo uso al onboarding alojado por la pasarela. */
  abstract createOnboardingLink(accountId: string, urls: OnboardingUrls): Promise<string>;
  /** Enlace de un solo uso al panel de la cuenta conectada (pagos y transferencias). */
  abstract createDashboardLink(accountId: string): Promise<string>;
  /**
   * Verifica la firma del webhook y lo traduce a un evento del dominio.
   * Lanza si la firma es inválida; devuelve null para eventos que no interesan.
   */
  abstract parseWebhook(rawBody: Buffer, signature: string): PaymentEvent | null;
}
