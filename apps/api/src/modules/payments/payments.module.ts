import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { PaymentsService } from './application/payments.service';
import { PaymentProvider } from './domain/payment-provider';
import { PaymentsRepository } from './domain/payments.repository';
import { PrismaPaymentsRepository } from './infrastructure/prisma-payments.repository';
import { StripePaymentProvider } from './infrastructure/stripe-payment-provider';

/**
 * Pagos detrás del puerto PaymentProvider. El webhook vive en `bookings` (que orquesta
 * reserva + pago) para no crear una dependencia circular entre módulos.
 */
@Module({
  imports: [SettingsModule],
  providers: [
    PaymentsService,
    { provide: PaymentProvider, useClass: StripePaymentProvider },
    { provide: PaymentsRepository, useClass: PrismaPaymentsRepository },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
