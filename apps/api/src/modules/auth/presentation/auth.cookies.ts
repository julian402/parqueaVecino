import type { CookieOptions, Response } from 'express';
import type { AppConfigService } from '../../../config/app-config.service';
import type { Session } from '../application/auth.service';

export const ACCESS_COOKIE = 'pv_access';
export const REFRESH_COOKIE = 'pv_refresh';

function baseOptions(config: AppConfigService): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: config.get('COOKIE_SECURE') };
}

/** El refresh token solo viaja a las rutas de auth, no en cada petición. */
function refreshPath(config: AppConfigService): string {
  return `/${config.get('API_PREFIX')}/auth`;
}

export function setSessionCookies(res: Response, session: Session, config: AppConfigService): void {
  res.cookie(ACCESS_COOKIE, session.accessToken, {
    ...baseOptions(config),
    path: '/',
    maxAge: session.accessTtlSeconds * 1000,
  });
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...baseOptions(config),
    path: refreshPath(config),
    maxAge: session.refreshTtlSeconds * 1000,
  });
}

export function clearSessionCookies(res: Response, config: AppConfigService): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(config), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(config), path: refreshPath(config) });
}
