import { PaymentStatus, PayoutAccountStatus } from '@parqueavecino/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../../../config/app-config.service';
import type { SettingsService } from '../../settings/application/settings.service';
import type { PaymentProvider, ProviderPayoutStatus } from '../domain/payment-provider';
import type { NewPayment, PaymentRecord, PaymentsRepository } from '../domain/payments.repository';
import {
  PayoutAccountsRepository,
  type PayoutAccountRecord,
} from '../domain/payout-accounts.repository';
import { PaymentsService } from './payments.service';

class MemoryPayoutAccounts extends PayoutAccountsRepository {
  rows: PayoutAccountRecord[] = [];
  findByUser(userId: string) {
    return Promise.resolve(this.rows.find((row) => row.userId === userId) ?? null);
  }
  create(account: Omit<PayoutAccountRecord, 'status'>) {
    const row = { ...account, status: PayoutAccountStatus.PENDING };
    this.rows.push(row);
    return Promise.resolve(row);
  }
  setStatus(userId: string, status: PayoutAccountStatus) {
    const row = this.rows.find((r) => r.userId === userId);
    if (row) row.status = status;
    return Promise.resolve();
  }
}

const charge = {
  bookingId: 'b1',
  payeeId: 'partner-1',
  amountMinor: 18_000_000,
  currency: 'COP',
  description: 'Mensualidad',
};

describe('PaymentsService', () => {
  let accounts: MemoryPayoutAccounts;
  let payments: PaymentRecord[];
  let payoutStatus: ProviderPayoutStatus;
  let provider: {
    name: string;
    enabled: boolean;
    createPayment: ReturnType<typeof vi.fn>;
    refundPayment: ReturnType<typeof vi.fn>;
    createPayoutAccount: ReturnType<typeof vi.fn>;
    getPayoutStatus: ReturnType<typeof vi.fn>;
    createOnboardingLink: ReturnType<typeof vi.fn>;
  };
  let config: Record<string, string | undefined>;
  let service: PaymentsService;

  beforeEach(() => {
    accounts = new MemoryPayoutAccounts();
    payments = [];
    payoutStatus = 'active';
    config = { WEB_URL: 'https://parquea.test' };
    provider = {
      name: 'stripe',
      enabled: true,
      createPayment: vi
        .fn()
        .mockResolvedValue({ id: 'pi_1', status: 'pending', clientSecret: 's' }),
      refundPayment: vi.fn(),
      createPayoutAccount: vi.fn().mockResolvedValue('acct_1'),
      getPayoutStatus: vi.fn(() => Promise.resolve(payoutStatus)),
      createOnboardingLink: vi.fn().mockResolvedValue('https://connect.stripe.test/onboarding'),
    };
    const repository = {
      create: vi.fn((payment: NewPayment) => {
        const row = { ...payment, id: `pay${payments.length + 1}`, status: PaymentStatus.PENDING };
        payments.push({ ...row, paidAt: null });
        return Promise.resolve(row);
      }),
      findLatestForBooking: vi.fn((bookingId: string) =>
        Promise.resolve(payments.findLast((p) => p.bookingId === bookingId) ?? null),
      ),
      setStatus: vi.fn(),
    };
    service = new PaymentsService(
      provider as unknown as PaymentProvider,
      repository as unknown as PaymentsRepository,
      accounts,
      { get: vi.fn().mockResolvedValue(1_000) } as unknown as SettingsService,
      { get: (key: string) => config[key] } as unknown as AppConfigService,
    );
  });

  it('sin cuenta conectada cobra la plataforma y solo registra la comisión', async () => {
    await service.startCharge(charge);
    expect(provider.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ commissionMinor: 1_800_000, destinationAccountId: undefined }),
    );
    expect(payments[0]).toMatchObject({ commissionMinor: 1_800_000, destinationRef: null });
  });

  it('con la cuenta activa hace un cargo con destino al aliado', async () => {
    accounts.rows.push({
      userId: 'partner-1',
      provider: 'stripe',
      providerRef: 'acct_1',
      status: PayoutAccountStatus.ACTIVE,
    });
    await service.startCharge(charge);
    expect(provider.getPayoutStatus).toHaveBeenCalledWith('acct_1');
    expect(provider.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ commissionMinor: 1_800_000, destinationAccountId: 'acct_1' }),
    );
    expect(payments[0]?.destinationRef).toBe('acct_1');
  });

  it('vuelve a revisar la cuenta antes de cobrar: si quedó restringida cobra la plataforma', async () => {
    accounts.rows.push({
      userId: 'partner-1',
      provider: 'stripe',
      providerRef: 'acct_1',
      status: PayoutAccountStatus.ACTIVE,
    });
    payoutStatus = 'action_required';
    await service.startCharge(charge);
    expect(provider.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ destinationAccountId: undefined }),
    );
    expect(accounts.rows[0]?.status).toBe(PayoutAccountStatus.ACTION_REQUIRED);
  });

  it('si la pasarela no responde al revisar la cuenta, igual vende (cobra la plataforma)', async () => {
    accounts.rows.push({
      userId: 'partner-1',
      provider: 'stripe',
      providerRef: 'acct_1',
      status: PayoutAccountStatus.ACTIVE,
    });
    provider.getPayoutStatus.mockRejectedValueOnce(new Error('timeout'));
    await service.startCharge(charge);
    expect(payments[0]?.destinationRef).toBeNull();
  });

  it('el reembolso de un cargo con destino revierte la transferencia', async () => {
    payments.push(
      {
        id: 'pay1',
        bookingId: 'b1',
        provider: 'stripe',
        providerRef: 'pi_1',
        amountMinor: 1,
        commissionMinor: 0,
        currency: 'COP',
        status: PaymentStatus.SUCCEEDED,
        destinationRef: 'acct_1',
        paidAt: new Date(),
      },
      {
        id: 'pay2',
        bookingId: 'b2',
        provider: 'stripe',
        providerRef: 'pi_2',
        amountMinor: 1,
        commissionMinor: 0,
        currency: 'COP',
        status: PaymentStatus.SUCCEEDED,
        destinationRef: null,
        paidAt: new Date(),
      },
    );
    await service.refund('b1');
    await service.refund('b2');
    expect(provider.refundPayment).toHaveBeenNthCalledWith(1, 'pi_1', 'refund-pay1', {
      reverseTransfer: true,
    });
    expect(provider.refundPayment).toHaveBeenNthCalledWith(2, 'pi_2', 'refund-pay2', {
      reverseTransfer: false,
    });
  });

  it('el onboarding crea la cuenta una sola vez y vuelve al panel del aliado', async () => {
    const payee = { id: 'partner-1', email: 'aliado@test.co', fullName: 'Aliado' };
    const link = await service.startOnboarding(payee);
    await service.startOnboarding(payee);

    expect(link.url).toBe('https://connect.stripe.test/onboarding');
    expect(provider.createPayoutAccount).toHaveBeenCalledTimes(1);
    expect(provider.createPayoutAccount).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'payout-account-partner-1' }),
    );
    expect(provider.createOnboardingLink).toHaveBeenCalledWith('acct_1', {
      returnUrl: 'https://parquea.test/aliados/pagos?onboarding=return',
      refreshUrl: 'https://parquea.test/aliados/pagos?onboarding=refresh',
    });
  });

  it('muestra el estado actualizado de la cuenta y si los pagos están configurados', async () => {
    expect(await service.payoutAccount('partner-1')).toEqual({
      paymentsEnabled: true,
      status: null,
    });
    accounts.rows.push({
      userId: 'partner-1',
      provider: 'stripe',
      providerRef: 'acct_1',
      status: PayoutAccountStatus.PENDING,
    });
    expect(await service.payoutAccount('partner-1')).toMatchObject({
      status: PayoutAccountStatus.ACTIVE,
    });
    provider.enabled = false;
    expect(await service.payoutAccount('partner-1')).toEqual({
      paymentsEnabled: false,
      status: null,
    });
  });
});
