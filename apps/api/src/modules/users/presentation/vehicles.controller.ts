import { Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import {
  vehicleInputSchema,
  vehicleSchema,
  type Vehicle,
  type VehicleInput,
} from '@parqueavecino/contracts';
import { z } from 'zod';
import { ApiZodResponse, UuidParam, ZodBody } from '../../../common/validation/zod';
import { CurrentUser, type AuthenticatedUser } from '../../auth/presentation/auth.decorators';
import { UsersService } from '../application/users.service';

@ApiTags('vehicles')
@Controller('me/vehicles')
export class VehiclesController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiZodResponse(z.array(vehicleSchema))
  list(@CurrentUser() user: AuthenticatedUser): Promise<Vehicle[]> {
    return this.users.listVehicles(user.id);
  }

  @Post()
  @ApiZodResponse(vehicleSchema, HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(vehicleInputSchema) input: VehicleInput,
  ): Promise<Vehicle> {
    return this.users.addVehicle(user.id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthenticatedUser, @UuidParam('id') id: string): Promise<void> {
    return this.users.removeVehicle(user.id, id);
  }
}
