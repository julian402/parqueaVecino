import { createHash, randomBytes } from 'node:crypto';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser, LoginInput, RegisterInput, UserRole } from '@parqueavecino/contracts';
import { parseDurationToSeconds } from '@parqueavecino/utils';
import { AppConfigService } from '../../../config/app-config.service';
import { UsersService } from '../../users/application/users.service';
import { toAuthUser, type User } from '../../users/domain/user';
import { PasswordHasher, RefreshTokenRepository } from '../domain/ports';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface Session {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';
const INVALID_SESSION = 'La sesión expiró, ingresa de nuevo';
const ACCOUNT_DISABLED = 'Tu cuenta está suspendida. Escríbenos para reactivarla.';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async register(input: RegisterInput): Promise<Session> {
    const user = await this.users.create({
      email: input.email,
      fullName: input.fullName,
      phone: input.phone ?? null,
      role: input.role,
      passwordHash: await this.hasher.hash(input.password),
    });
    return this.startSession(user);
  }

  async login(input: LoginInput): Promise<Session> {
    const user = await this.users.findByEmail(input.email);
    // Mismo mensaje si el correo no existe o la clave es incorrecta (no revela cuentas).
    if (!user || !(await this.hasher.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!user.isActive) throw new ForbiddenException(ACCOUNT_DISABLED);
    return this.startSession(user);
  }

  /** Rota el refresh token: el usado queda revocado y se emite uno nuevo. */
  async refresh(refreshToken: string | undefined): Promise<Session> {
    if (!refreshToken) throw new UnauthorizedException(INVALID_SESSION);

    const stored = await this.refreshTokens.findByHash(hashToken(refreshToken));
    if (!stored) throw new UnauthorizedException(INVALID_SESSION);

    if (stored.revokedAt) {
      // Un token ya usado se presenta otra vez: posible robo. Se cierran todas las sesiones.
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw new UnauthorizedException(INVALID_SESSION);
    }
    if (stored.expiresAt <= new Date()) throw new UnauthorizedException(INVALID_SESSION);

    const user = await this.users.findById(stored.userId);
    if (!user?.isActive) throw new UnauthorizedException(INVALID_SESSION);

    await this.refreshTokens.revoke(stored.id);
    return this.startSession(user);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const stored = await this.refreshTokens.findByHash(hashToken(refreshToken));
    if (stored) await this.refreshTokens.revoke(stored.id);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(INVALID_SESSION);
    return toAuthUser(user);
  }

  /** Para que el admin cree usuarios o cambie contraseñas con el mismo algoritmo. */
  hashPassword(plain: string): Promise<string> {
    return this.hasher.hash(plain);
  }

  /** Cierra todas las sesiones (al suspender una cuenta o cambiar su contraseña). */
  revokeSessions(userId: string): Promise<void> {
    return this.refreshTokens.revokeAllForUser(userId);
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token);
  }

  private async startSession(user: User): Promise<Session> {
    const accessTtlSeconds = parseDurationToSeconds(this.config.get('JWT_ACCESS_TTL'));
    const refreshTtlSeconds = parseDurationToSeconds(this.config.get('JWT_REFRESH_TTL'));

    const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessTtlSeconds });

    const refreshToken = randomBytes(48).toString('base64url');
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
    });

    return {
      user: toAuthUser(user),
      accessToken,
      refreshToken,
      accessTtlSeconds,
      refreshTtlSeconds,
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
