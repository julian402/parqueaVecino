import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { ParkingLotsService } from './application/parking-lots.service';
import { ParkingLotsRepository } from './domain/parking-lots.repository';
import { PrismaParkingLotsRepository } from './infrastructure/prisma-parking-lots.repository';
import {
  ParkingLotsController,
  PartnerParkingLotsController,
} from './presentation/parking-lots.controller';

@Module({
  imports: [SettingsModule],
  controllers: [ParkingLotsController, PartnerParkingLotsController],
  providers: [
    ParkingLotsService,
    { provide: ParkingLotsRepository, useClass: PrismaParkingLotsRepository },
  ],
  exports: [ParkingLotsService],
})
export class ParkingLotsModule {}
