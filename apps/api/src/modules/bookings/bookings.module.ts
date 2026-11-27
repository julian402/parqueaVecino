import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParkingLotsModule } from '../parking-lots/parking-lots.module';
import { PaymentsModule } from '../payments/payments.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { BookingsService } from './application/bookings.service';
import { BookingsRepository } from './domain/bookings.repository';
import { PrismaBookingsRepository } from './infrastructure/prisma-bookings.repository';
import {
  BookingsController,
  PartnerController,
  PaymentWebhooksController,
} from './presentation/bookings.controller';

@Module({
  imports: [ParkingLotsModule, PaymentsModule, UsersModule, SettingsModule, NotificationsModule],
  controllers: [BookingsController, PartnerController, PaymentWebhooksController],
  providers: [BookingsService, { provide: BookingsRepository, useClass: PrismaBookingsRepository }],
  exports: [BookingsService],
})
export class BookingsModule {}
