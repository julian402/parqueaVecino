import { Injectable } from '@nestjs/common';
import {
  USER_ROLES,
  type AdminUserListQuery,
  type UserRole,
  type Vehicle,
  type VehicleInput,
} from '@parqueavecino/contracts';
import { PrismaService } from '../../../common/database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import {
  UsersRepository,
  VehiclesRepository,
  type NewUser,
  type User,
  type UserChanges,
  type UserPage,
} from '../domain/user';

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

  update(id: string, changes: UserChanges): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: changes });
  }

  async list({ page, pageSize, q, role }: AdminUserListQuery): Promise<UserPage> {
    const where: Prisma.UserWhereInput = {
      role,
      ...(q && {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { fullName: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  async countByRole(): Promise<Record<UserRole, number>> {
    const rows = await this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } });
    const counts = Object.fromEntries(USER_ROLES.map((role) => [role, 0])) as Record<
      UserRole,
      number
    >;
    for (const row of rows) counts[row.role] = row._count._all;
    return counts;
  }

  async deleteIfUnused(id: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { _count: { select: { parkingLots: true, bookings: true } } },
    });
    if (!user || user._count.parkingLots > 0 || user._count.bookings > 0) return false;
    await this.prisma.user.delete({ where: { id } });
    return true;
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
