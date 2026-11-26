import { Module } from '@nestjs/common';
import { UsersService } from './application/users.service';
import { UsersRepository, VehiclesRepository } from './domain/user';
import {
  PrismaUsersRepository,
  PrismaVehiclesRepository,
} from './infrastructure/prisma-users.repository';
import { VehiclesController } from './presentation/vehicles.controller';

@Module({
  controllers: [VehiclesController],
  providers: [
    UsersService,
    { provide: UsersRepository, useClass: PrismaUsersRepository },
    { provide: VehiclesRepository, useClass: PrismaVehiclesRepository },
  ],
  exports: [UsersService],
})
export class UsersModule {}
