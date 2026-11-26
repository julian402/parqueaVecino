import type { ApiError } from '@parqueavecino/contracts';
import { env } from '@/env';

/** Error HTTP con el cuerpo estándar de la API (`ApiError`). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | undefined,
  ) {
    super(body?.message ?? `HTTP ${status}`);
  }
}

const REFRESH_PATH = '/auth/refresh';
/** Rutas donde un 401 es una respuesta válida y no se debe intentar renovar la sesión. */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', REFRESH_PATH, '/auth/logout'];

let refreshing: Promise<boolean> | null = null;

/** Renueva la sesión una sola vez aunque varias peticiones fallen a la vez. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${env.NEXT_PUBLIC_API_URL}${REFRESH_PATH}`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Mutator de Orval: todas las llamadas generadas pasan por aquí.
 * Envía cookies (sesión httpOnly) y reintenta una vez tras renovar la sesión si recibe 401.
 */
export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const request = () =>
    fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });

  let response = await request();
  if (response.status === 401 && !NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
    if (await refreshSession()) response = await request();
  }

  if (!response.ok) {
    throw new HttpError(
      response.status,
      await parse<ApiError | undefined>(response).catch(() => undefined),
    );
  }
  return parse<T>(response);
}
