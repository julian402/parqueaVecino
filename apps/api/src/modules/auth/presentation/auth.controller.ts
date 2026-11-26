import { Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import {
  authUserSchema,
  loginSchema,
  registerSchema,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
} from '@parqueavecino/contracts';
import type { Request, Response } from 'express';
import { ApiZodResponse, ZodBody } from '../../../common/validation/zod';
import { AppConfigService } from '../../../config/app-config.service';
import { AuthService } from '../application/auth.service';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from './auth.cookies';
import { CurrentUser, Public, type AuthenticatedUser } from './auth.decorators';

function readRefreshCookie(request: Request): string | undefined {
  return (request.cookies as Record<string, string | undefined> | undefined)?.[REFRESH_COOKIE];
}

@ApiTags('auth')
// Límite de intentos por IP en todo el controlador (fuerza bruta de contraseñas, registro masivo).
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiZodResponse(authUserSchema, HttpStatus.CREATED)
  async register(
    @ZodBody(registerSchema) input: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const session = await this.auth.register(input);
    setSessionCookies(res, session, this.config);
    return session.user;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiZodResponse(authUserSchema)
  async login(
    @ZodBody(loginSchema) input: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const session = await this.auth.login(input);
    setSessionCookies(res, session, this.config);
    return session.user;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiZodResponse(authUserSchema)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthUser> {
    try {
      const session = await this.auth.refresh(readRefreshCookie(req));
      setSessionCookies(res, session, this.config);
      return session.user;
    } catch (error) {
      clearSessionCookies(res, this.config);
      throw error;
    }
  }

  @Public()
  @SkipThrottle()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readRefreshCookie(req));
    clearSessionCookies(res, this.config);
  }

  @Get('me')
  @ApiZodResponse(authUserSchema)
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUser> {
    return this.auth.me(user.id);
  }
}
