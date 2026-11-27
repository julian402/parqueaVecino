import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { ParkingLotsModule } from '../parking-lots/parking-lots.module';
import { SettingsModule } from '../settings/settings.module';
import { PartnerAnalyticsService } from './application/partner-analytics.service';
import { PartnerAnalyticsController } from './presentation/partner-analytics.controller';

@Module({
  imports: [BookingsModule, ParkingLotsModule, SettingsModule],
  controllers: [PartnerAnalyticsController],
  providers: [PartnerAnalyticsService],
})
export class PartnerAnalyticsModule {}
