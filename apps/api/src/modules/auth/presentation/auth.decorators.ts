import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@parqueavecino/contracts';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/** Usuario autenticado que el guard deja en `request.user`. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export type RequestWithUser = { user?: AuthenticatedUser };

/** Endpoint accesible sin sesión. Por defecto todos los endpoints exigen sesión. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe el endpoint a ciertos roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) throw new Error('CurrentUser usado en un endpoint público');
    return request.user;
  },
);
