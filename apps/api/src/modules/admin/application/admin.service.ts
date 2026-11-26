import { BadRequestException, Injectable } from '@nestjs/common';
import {
  UserRole,
  type AdminStats,
  type AdminUser,
  type AdminUserCreateInput,
  type AdminUserUpdateInput,
} from '@parqueavecino/contracts';
import { AuthService } from '../../auth/application/auth.service';
import { BookingsService } from '../../bookings/application/bookings.service';
import { ParkingLotsService } from '../../parking-lots/application/parking-lots.service';
import { PaymentsService } from '../../payments/application/payments.service';
import { UsersService } from '../../users/application/users.service';
import { toAdminUser, type UserChanges } from '../../users/domain/user';

/**
 * Panel del dueño de la plataforma. No tiene tablas propias: orquesta los servicios
 * exportados de cada módulo (regla: un módulo no lee las tablas de otro).
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly lots: ParkingLotsService,
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
  ) {}

  async stats(): Promise<AdminStats> {
    const [byRole, lotsByStatus, bookingsByStatus, revenue, spots] = await Promise.all([
      this.users.countByRole(),
      this.lots.countByStatus(),
      this.bookings.countByStatus(),
      this.payments.revenue(),
      this.lots.spotTotals(),
    ]);
    const sum = (record: Record<string, number>) =>
      Object.values(record).reduce((total, value) => total + value, 0);
    const sold = spots.totalSpots - spots.availableSpots;
    return {
      users: { total: sum(byRole), byRole },
      parkingLots: { total: sum(lotsByStatus), byStatus: lotsByStatus },
      bookings: { total: sum(bookingsByStatus), byStatus: bookingsByStatus },
      revenue,
      occupancy: spots.totalSpots > 0 ? Math.min(1, Math.max(0, sold / spots.totalSpots)) : 0,
      paymentsEnabled: this.payments.enabled,
    };
  }

  async createUser(input: AdminUserCreateInput): Promise<AdminUser> {
    const user = await this.users.create({
      email: input.email,
      fullName: input.fullName,
      phone: input.phone ?? null,
      role: input.role,
      passwordHash: await this.auth.hashPassword(input.password),
    });
    return toAdminUser(user);
  }

  async updateUser(
    actorId: string,
    id: string,
    { password, ...input }: AdminUserUpdateInput,
  ): Promise<AdminUser> {
    if (actorId === id && (input.isActive === false || (input.role && input.role !== 'ADMIN'))) {
      // Evita que el único admin se quede sin acceso al panel por error.
      throw new BadRequestException('No puedes suspenderte ni quitarte el rol de administrador');
    }
    const changes: UserChanges = { ...input };
    if (password) changes.passwordHash = await this.auth.hashPassword(password);
    const user = await this.users.update(id, changes);
    if (password || input.isActive === false || input.role) {
      await this.auth.revokeSessions(id);
    }
    return toAdminUser(user);
  }

  async deleteUser(actorId: string, id: string): Promise<void> {
    if (actorId === id) throw new BadRequestException('No puedes eliminar tu propia cuenta');
    const user = await this.users.getOrThrow(id);
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Para eliminar un administrador, primero cámbiale el rol');
    }
    await this.users.delete(id);
  }
}
