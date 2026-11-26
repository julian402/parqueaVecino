import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Vehicle, VehicleInput } from '@parqueavecino/contracts';
import { UsersRepository, VehiclesRepository, type NewUser, type User } from '../domain/user';

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

  listVehicles(userId: string): Promise<Vehicle[]> {
    return this.vehicles.listByUser(userId);
  }

  async addVehicle(userId: string, input: VehicleInput): Promise<Vehicle> {
    if (await this.vehicles.findByPlate(userId, input.plate)) {
      throw new ConflictException('Ya registraste un vehículo con esa placa');
    }
    return this.vehicles.create(userId, input);
  }

  async removeVehicle(userId: string, vehicleId: string): Promise<void> {
    if (!(await this.vehicles.delete(userId, vehicleId))) {
      throw new NotFoundException('Vehículo no encontrado');
    }
  }
}
