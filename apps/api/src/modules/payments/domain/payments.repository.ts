import type {
  AdminPayment,
  AdminPaymentListQuery,
  PaymentStatus,
  RevenueSummary,
} from '@parqueavecino/contracts';

export interface PaymentRecord {
  id: string;
  bookingId: string;
  provider: string;
  providerRef: string;
  amountMinor: number;
  commissionMinor: number;
  currency: string;
  status: PaymentStatus;
  /** Cuenta conectada que recibió el pago (null = cobro de la plataforma). */
  destinationRef: string | null;
  paidAt: Date | null;
}

export type NewPayment = Omit<PaymentRecord, 'id' | 'status' | 'paidAt'>;

export interface RevenueQuery {
  currency: string;
  timezone: string;
  days: number;
  /** Solo pagos de parqueaderos de este aliado. */
  partnerId?: string;
}

export abstract class PaymentsRepository {
  abstract create(payment: NewPayment): Promise<PaymentRecord>;
  abstract findByProviderRef(providerRef: string): Promise<PaymentRecord | null>;
  abstract findLatestForBooking(bookingId: string): Promise<PaymentRecord | null>;
  abstract setStatus(id: string, status: PaymentStatus, paidAt?: Date): Promise<void>;
  abstract listForAdmin(query: AdminPaymentListQuery): Promise<{
    items: AdminPayment[];
    total: number;
  }>;
  abstract revenue(query: RevenueQuery): Promise<RevenueSummary>;
}
