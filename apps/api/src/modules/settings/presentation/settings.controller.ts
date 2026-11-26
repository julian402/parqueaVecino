import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { publicSettingsSchema, type PublicSettings } from '@parqueavecino/contracts';
import { ApiZodResponse } from '../../../common/validation/zod';
import { Public } from '../../auth/presentation/auth.decorators';
import { SettingsService } from '../application/settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Parámetros que la web necesita sin sesión (horarios de franjas, cancelación...). */
  @Public()
  @Get('public')
  @ApiZodResponse(publicSettingsSchema)
  getPublic(): Promise<PublicSettings> {
    return this.settings.getPublic();
  }
}
