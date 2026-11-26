import type { AuthUser, UserRole, Vehicle, VehicleInput } from '@parqueavecino/contracts';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  passwordHash: string;
}

export type NewUser = Omit<User, 'id'>;

export abstract class UsersRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract create(user: NewUser): Promise<User>;
}

export abstract class VehiclesRepository {
  abstract listByUser(userId: string): Promise<Vehicle[]>;
  abstract findByPlate(userId: string, plate: string): Promise<Vehicle | null>;
  abstract create(userId: string, input: VehicleInput): Promise<Vehicle>;
  /** Devuelve false si el vehículo no existe o no es del usuario. */
  abstract delete(userId: string, vehicleId: string): Promise<boolean>;
}

/** Datos públicos del usuario: nunca exponer passwordHash. */
export function toAuthUser({ id, email, fullName, phone, role }: User): AuthUser {
  return { id, email, fullName, phone, role };
}
