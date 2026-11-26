import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppConfigService } from '../../../config/app-config.service';
import type { UsersService } from '../../users/application/users.service';
import type { NewUser, User } from '../../users/domain/user';
import { PasswordHasher, RefreshTokenRepository, type StoredRefreshToken } from '../domain/ports';
import { AuthService } from './auth.service';

class FakeHasher extends PasswordHasher {
  hash(plain: string) {
    return Promise.resolve(`hashed:${plain}`);
  }
  verify(hash: string, plain: string) {
    return Promise.resolve(hash === `hashed:${plain}`);
  }
}

class FakeRefreshTokens extends RefreshTokenRepository {
  rows: (StoredRefreshToken & { tokenHash: string })[] = [];
  create(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    this.rows.push({ id: String(this.rows.length + 1), revokedAt: null, ...data });
    return Promise.resolve();
  }
  findByHash(tokenHash: string) {
    return Promise.resolve(this.rows.find((row) => row.tokenHash === tokenHash) ?? null);
  }
  revoke(id: string) {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.revokedAt = new Date();
    return Promise.resolve();
  }
  revokeAllForUser(userId: string) {
    this.rows.filter((r) => r.userId === userId).forEach((r) => (r.revokedAt = new Date()));
    return Promise.resolve();
  }
}

function fakeUsers(users: User[]): UsersService {
  return {
    findById: (id: string) => Promise.resolve(users.find((u) => u.id === id) ?? null),
    findByEmail: (email: string) => Promise.resolve(users.find((u) => u.email === email) ?? null),
    create: (data: NewUser) => {
      const user: User = {
        ...data,
        id: `user-${users.length + 1}`,
        isActive: true,
        createdAt: new Date(),
      };
      users.push(user);
      return Promise.resolve(user);
    },
  } as unknown as UsersService;
}

const config = {
  get: (key: string) => ({ JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d' })[key],
} as unknown as AppConfigService;

describe('AuthService', () => {
  let service: AuthService;
  let tokens: FakeRefreshTokens;
  let users: User[];

  beforeEach(() => {
    tokens = new FakeRefreshTokens();
    users = [];
    service = new AuthService(
      fakeUsers(users),
      new FakeHasher(),
      tokens,
      new JwtService({ secret: 'test-secret-test-secret-test-secret' }),
      config,
    );
  });

  const registration = {
    fullName: 'Ana Pérez',
    email: 'ana@mail.com',
    password: 'clave1234',
    role: 'DRIVER' as const,
  };

  it('registra, firma un access token válido y no expone el hash', async () => {
    const session = await service.register(registration);
    expect(session.user).not.toHaveProperty('passwordHash');
    expect(session.accessTtlSeconds).toBe(900);
    const payload = await service.verifyAccessToken(session.accessToken);
    expect(payload).toMatchObject({ sub: session.user.id, role: 'DRIVER' });
    // Solo se guarda el hash del refresh token.
    expect(tokens.rows[0]?.tokenHash).not.toBe(session.refreshToken);
  });

  it('rechaza credenciales inválidas con el mismo mensaje', async () => {
    await service.register(registration);
    const wrongPassword = service.login({ email: registration.email, password: 'otra1234' });
    const unknownEmail = service.login({ email: 'nadie@mail.com', password: 'clave1234' });
    await expect(wrongPassword).rejects.toThrow('Correo o contraseña incorrectos');
    await expect(unknownEmail).rejects.toThrow('Correo o contraseña incorrectos');
  });

  it('rota el refresh token y cierra todo si se reutiliza uno viejo', async () => {
    const first = await service.register(registration);
    const second = await service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    // La reutilización revocó también el token nuevo.
    await expect(service.refresh(second.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('no deja ingresar ni renovar la sesión a una cuenta suspendida', async () => {
    const session = await service.register(registration);
    users.forEach((user) => (user.isActive = false));

    await expect(
      service.login({ email: registration.email, password: registration.password }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
