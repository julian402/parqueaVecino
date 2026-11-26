import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminUserListQuery,
  AdminUserPage,
  UserRole,
  Vehicle,
  VehicleInput,
} from '@parqueavecino/contracts';
import {
  toAdminUser,
  UsersRepository,
  VehiclesRepository,
  type NewUser,
  type User,
  type UserChanges,
} from '../domain/user';

const USER_NOT_FOUND = 'Usuario no encontrado';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly vehicles: VehiclesRepository,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email);
  }

  async create(user: NewUser): Promise<User> {
    if (await this.users.findByEmail(user.email)) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }
    return this.users.create(user);
  }

  async update(id: string, changes: UserChanges): Promise<User> {
    await this.getOrThrow(id);
    return this.users.update(id, changes);
  }

  async list(query: AdminUserListQuery): Promise<AdminUserPage> {
    const { items, total } = await this.users.list(query);
    return { items: items.map(toAdminUser), total, page: query.page, pageSize: query.pageSize };
  }

  countByRole(): Promise<Record<UserRole, number>> {
    return this.users.countByRole();
  }

  async delete(id: string): Promise<void> {
    await this.getOrThrow(id);
    if (!(await this.users.deleteIfUnused(id))) {
      throw new ConflictException(
        'El usuario tiene parqueaderos o reservas: desactívalo en lugar de borrarlo',
      );
    }
  }

  async getOrThrow(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException(USER_NOT_FOUND);
    return user;
  }

  listVehicles(userId: string): Promise<Vehicle[]> {
    return this.vehicles.listByUser(userId);
  }

  async addVehicle(userId: string, input: VehicleInput): Promise<Vehicle> {
    if (await this.vehicles.findByPlate(userId, input.plate)) {
      throw new ConflictException('Ya registraste un vehículo con esa placa');
    }
    return this.vehicles.create(userId, input);
  }

  /** Registra el vehículo si aún no existe (al reservar con una placa nueva). */
  async ensureVehicle(userId: string, input: VehicleInput): Promise<Vehicle> {
    return (
      (await this.vehicles.findByPlate(userId, input.plate)) ?? this.vehicles.create(userId, input)
    );
  }

  async removeVehicle(userId: string, vehicleId: string): Promise<void> {
    if (!(await this.vehicles.delete(userId, vehicleId))) {
      throw new NotFoundException('Vehículo no encontrado');
    }
  }
}
