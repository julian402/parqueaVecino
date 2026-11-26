import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { GeocodingService } from './application/geocoding.service';
import { Geocoder } from './domain/geocoder';
import { NominatimGeocoder } from './infrastructure/nominatim.geocoder';
import { GeocodingController } from './presentation/geocoding.controller';

@Module({
  imports: [SettingsModule],
  controllers: [GeocodingController],
  providers: [GeocodingService, { provide: Geocoder, useClass: NominatimGeocoder }],
})
export class GeocodingModule {}
