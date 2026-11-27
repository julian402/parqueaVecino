import type { PayoutAccountStatus } from '@parqueavecino/contracts';

/** Cuenta conectada del aliado en la pasarela. */
export interface PayoutAccountRecord {
  userId: string;
  provider: string;
  providerRef: string;
  status: PayoutAccountStatus;
}

export abstract class PayoutAccountsRepository {
  abstract findByUser(userId: string): Promise<PayoutAccountRecord | null>;
  /** Idempotente por usuario: si ya existe, devuelve la guardada. */
  abstract create(account: Omit<PayoutAccountRecord, 'status'>): Promise<PayoutAccountRecord>;
  abstract setStatus(userId: string, status: PayoutAccountStatus): Promise<void>;
}
