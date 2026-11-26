import { Injectable } from '@nestjs/common';
import type { Vehicle, VehicleInput } from '@parqueavecino/contracts';
import { PrismaService } from '../../../common/database/prisma.service';
import { UsersRepository, VehiclesRepository, type NewUser, type User } from '../domain/user';

@Injectable()
export class PrismaUsersRepository extends UsersRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(user: NewUser): Promise<User> {
    return this.prisma.user.create({ data: user });
  }
}

const vehicleSelect = { id: true, plate: true, type: true, nickname: true } as const;

@Injectable()
export class PrismaVehiclesRepository extends VehiclesRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  listByUser(userId: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: { userId },
      select: vehicleSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  findByPlate(userId: string, plate: string): Promise<Vehicle | null> {
    return this.prisma.vehicle.findUnique({
      where: { userId_plate: { userId, plate } },
      select: vehicleSelect,
    });
  }

  create(userId: string, input: VehicleInput): Promise<Vehicle> {
    return this.prisma.vehicle.create({
      data: { userId, plate: input.plate, type: input.type, nickname: input.nickname },
      select: vehicleSelect,
    });
  }

  async delete(userId: string, vehicleId: string): Promise<boolean> {
    const { count } = await this.prisma.vehicle.deleteMany({ where: { id: vehicleId, userId } });
    return count > 0;
  }
}
