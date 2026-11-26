import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@parqueavecino/contracts';
import type { Request } from 'express';
import { AuthService } from '../application/auth.service';
import { ACCESS_COOKIE } from './auth.cookies';
import { IS_PUBLIC_KEY, ROLES_KEY, type RequestWithUser } from './auth.decorators';

function extractToken(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, string | undefined> | undefined;
  const fromCookie = cookies?.[ACCESS_COOKIE];
  if (fromCookie) return fromCookie;
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  return scheme === 'Bearer' ? token : undefined;
}

/** Guard global: exige sesión salvo en endpoints marcados con @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & RequestWithUser>();
    const token = extractToken(request);
    if (!token) throw new UnauthorizedException('Debes iniciar sesión');

    try {
      const payload = await this.auth.verifyAccessToken(token);
      request.user = { id: payload.sub, email: payload.email, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException('La sesión expiró');
    }
  }
}

/** Guard global: aplica @Roles(...) cuando está presente. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }
    return true;
  }
}
