import { Injectable } from '@nestjs/common';
import type { PayoutAccountStatus } from '@parqueavecino/contracts';
import { PrismaService } from '../../../common/database/prisma.service';
import {
  PayoutAccountsRepository,
  type PayoutAccountRecord,
} from '../domain/payout-accounts.repository';

const select = { userId: true, provider: true, providerRef: true, status: true } as const;

@Injectable()
export class PrismaPayoutAccountsRepository extends PayoutAccountsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findByUser(userId: string): Promise<PayoutAccountRecord | null> {
    return this.prisma.payoutAccount.findUnique({ where: { userId }, select });
  }

  create(account: Omit<PayoutAccountRecord, 'status'>): Promise<PayoutAccountRecord> {
    // Dos clics seguidos usan la misma idempotency key en la pasarela: misma cuenta, una fila.
    return this.prisma.payoutAccount.upsert({
      where: { userId: account.userId },
      create: account,
      update: {},
      select,
    });
  }

  async setStatus(userId: string, status: PayoutAccountStatus): Promise<void> {
    await this.prisma.payoutAccount.update({ where: { userId }, data: { status } });
  }
}
