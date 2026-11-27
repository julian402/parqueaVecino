import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { PaymentsService } from './application/payments.service';
import { PaymentProvider } from './domain/payment-provider';
import { PaymentsRepository } from './domain/payments.repository';
import { PayoutAccountsRepository } from './domain/payout-accounts.repository';
import { PrismaPaymentsRepository } from './infrastructure/prisma-payments.repository';
import { PrismaPayoutAccountsRepository } from './infrastructure/prisma-payout-accounts.repository';
import { StripePaymentProvider } from './infrastructure/stripe-payment-provider';
import { PartnerPayoutsController } from './presentation/partner-payouts.controller';

/**
 * Pagos detrás del puerto PaymentProvider. El webhook vive en `bookings` (que orquesta
 * reserva + pago) para no crear una dependencia circular entre módulos.
 */
@Module({
  imports: [SettingsModule, UsersModule],
  providers: [
    PaymentsService,
    { provide: PaymentProvider, useClass: StripePaymentProvider },
    { provide: PaymentsRepository, useClass: PrismaPaymentsRepository },
    { provide: PayoutAccountsRepository, useClass: PrismaPayoutAccountsRepository },
  ],
  controllers: [PartnerPayoutsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
