import { Injectable } from '@nestjs/common';
import type { OccupancyQuery, PartnerOccupancy } from '@parqueavecino/contracts';
import { AppConfigService } from '../../../config/app-config.service';
import { BookingsService } from '../../bookings/application/bookings.service';
import { ParkingLotsService } from '../../parking-lots/application/parking-lots.service';
import { SettingsService } from '../../settings/application/settings.service';
import { computeHourlyOccupancy } from '../domain/occupancy';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Analítica del panel del aliado (pantalla 7): ocupación por hora de sus parqueaderos. */
@Injectable()
export class PartnerAnalyticsService {
  constructor(
    private readonly bookings: BookingsService,
    private readonly lots: ParkingLotsService,
    private readonly settings: SettingsService,
    private readonly config: AppConfigService,
  ) {}

  async occupancy(
    partnerId: string,
    query: OccupancyQuery,
    now = new Date(),
  ): Promise<PartnerOccupancy> {
    // 404 si el parqueadero no es del aliado.
    if (query.parkingLotId) await this.lots.getForPartner(partnerId, query.parkingLotId);
    const from = new Date(now.getTime() - query.days * DAY_MS);
    const [periods, capacity, schedule] = await Promise.all([
      this.bookings.occupancyIntervals(partnerId, from, now, query.parkingLotId),
      this.lots.capacityByShift(partnerId, query.parkingLotId),
      this.settings.get('shift.schedule'),
    ]);
    const result = computeHourlyOccupancy({
      periods,
      capacity,
      schedule,
      from,
      to: now,
      timeZone: this.config.get('APP_TIMEZONE'),
    });
    return { days: query.days, from: from.toISOString(), to: now.toISOString(), ...result };
  }
}
