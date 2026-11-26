import { apiErrorSchema, type ApiError } from '@parqueavecino/contracts';
import { env } from '@/env';
import messages from '../../../messages/es.json';

/**
 * Error HTTP. Si la respuesta trae el formato estándar de la API (`ApiError`, del filtro global),
 * se muestra su mensaje; si no (API caída, proxy o red), uno genérico en español.
 * `status` 0 = no hubo respuesta (sin conexión).
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | undefined,
  ) {
    super(
      body?.message ??
        (status === 0 || status >= 500 ? messages.errors.unavailable : messages.errors.unexpected),
    );
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

/** Cuerpo de error solo si cumple el formato estándar de la API. */
async function parseError(response: Response): Promise<ApiError | undefined> {
  try {
    const parsed = apiErrorSchema.safeParse(JSON.parse(await response.text()));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined; // Texto plano (p. ej. "Internal Server Error" del proxy) o vacío.
  }
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
    }).catch(() => {
      // Sin red o servidor inalcanzable: mismo tipo de error que el resto.
      throw new HttpError(0, undefined);
    });

  let response = await request();
  if (response.status === 401 && !NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
    if (await refreshSession()) response = await request();
  }

  if (!response.ok) {
    throw new HttpError(response.status, await parseError(response));
  }
  return parse<T>(response);
}
