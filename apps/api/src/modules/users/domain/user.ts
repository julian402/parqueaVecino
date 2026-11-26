import type {
  AdminUser,
  AdminUserListQuery,
  AuthUser,
  UserRole,
  Vehicle,
  VehicleInput,
} from '@parqueavecino/contracts';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
}

export type NewUser = Omit<User, 'id' | 'isActive' | 'createdAt'>;

export type UserChanges = Partial<
  Pick<User, 'fullName' | 'phone' | 'role' | 'isActive' | 'passwordHash'>
>;

export interface UserPage {
  items: User[];
  total: number;
}

export abstract class UsersRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract create(user: NewUser): Promise<User>;
  abstract update(id: string, changes: UserChanges): Promise<User>;
  abstract list(query: AdminUserListQuery): Promise<UserPage>;
  abstract countByRole(): Promise<Record<UserRole, number>>;
  /** Borra solo si el usuario no tiene parqueaderos ni reservas. Devuelve false si tiene. */
  abstract deleteIfUnused(id: string): Promise<boolean>;
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

export function toAdminUser(user: User): AdminUser {
  return { ...toAuthUser(user), isActive: user.isActive, createdAt: user.createdAt.toISOString() };
}
