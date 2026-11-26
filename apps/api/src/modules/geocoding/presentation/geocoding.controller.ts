import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  geocodeQuerySchema,
  geocodeResultSchema,
  type GeocodeQuery,
  type GeocodeResult,
} from '@parqueavecino/contracts';
import { z } from 'zod';
import { ApiZodResponse, ZodQuery } from '../../../common/validation/zod';
import { Public } from '../../auth/presentation/auth.decorators';
import { GeocodingService } from '../application/geocoding.service';

@ApiTags('geocoding')
@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  @Public()
  @Get()
  @ApiZodResponse(z.array(geocodeResultSchema))
  search(@ZodQuery(geocodeQuerySchema) query: GeocodeQuery): Promise<GeocodeResult[]> {
    return this.geocoding.geocode(query.q);
  }
}
