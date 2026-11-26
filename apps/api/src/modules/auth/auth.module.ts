import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from '../../config/app-config.service';
import { UsersModule } from '../users/users.module';
import { AuthService } from './application/auth.service';
import { PasswordHasher, RefreshTokenRepository } from './domain/ports';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma-refresh-token.repository';
import { AuthController } from './presentation/auth.controller';
import { JwtAuthGuard, RolesGuard } from './presentation/auth.guards';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({ secret: config.get('JWT_ACCESS_SECRET') }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: RefreshTokenRepository, useClass: PrismaRefreshTokenRepository },
    // Orden importa: primero autentica, luego verifica rol.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
