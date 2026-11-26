import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/presentation/auth.decorators';

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

/** Usado por el health check del balanceador (ALB) en AWS. */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'La API está arriba' })
  check(): HealthResponse {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
