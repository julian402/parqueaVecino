import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  occupancyQuerySchema,
  partnerOccupancySchema,
  UserRole,
  type OccupancyQuery,
  type PartnerOccupancy,
} from '@parqueavecino/contracts';
import { ApiZodResponse, ZodQuery } from '../../../common/validation/zod';
import {
  CurrentUser,
  Roles,
  type AuthenticatedUser,
} from '../../auth/presentation/auth.decorators';
import { PartnerAnalyticsService } from '../application/partner-analytics.service';

@ApiTags('partner')
@Roles(UserRole.PARTNER)
@Controller('partner/analytics')
export class PartnerAnalyticsController {
  constructor(private readonly analytics: PartnerAnalyticsService) {}

  /** Ocupación promedio por hora del día en los últimos N días. */
  @Get('occupancy')
  @ApiZodResponse(partnerOccupancySchema)
  occupancy(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(occupancyQuerySchema) query: OccupancyQuery,
  ): Promise<PartnerOccupancy> {
    return this.analytics.occupancy(user.id, query);
  }
}
