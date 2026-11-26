import { afterEach, describe, expect, it, vi } from 'vitest';
import messages from '../../../messages/es.json';
import { http, HttpError } from './http';

// La validación real de variables NEXT_PUBLIC_* no aplica en pruebas unitarias.
vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_API_URL: '/api' } }));

function reply(status: number, body: string) {
  return vi.fn().mockResolvedValue(new Response(body, { status }));
}

describe('http', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('usa el mensaje del formato estándar de la API', async () => {
    const body = {
      statusCode: 401,
      error: 'UNAUTHORIZED',
      message: 'Correo o contraseña incorrectos',
      timestamp: '2026-11-26T00:00:00.000Z',
      path: '/api/auth/login',
    };
    vi.stubGlobal('fetch', reply(401, JSON.stringify(body)));
    const error = await http('/auth/login', { method: 'POST' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).message).toBe(body.message);
    expect((error as HttpError).body?.error).toBe('UNAUTHORIZED');
  });

  it('con la API caída (texto plano del proxy) muestra un mensaje claro', async () => {
    vi.stubGlobal('fetch', reply(500, 'Internal Server Error'));
    const error = (await http('/auth/login').catch((e: unknown) => e)) as HttpError;
    expect(error.status).toBe(500);
    expect(error.body).toBeUndefined();
    expect(error.message).toBe(messages.errors.unavailable);
  });

  it('sin conexión responde con status 0 y el mismo mensaje', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const error = (await http('/auth/login').catch((e: unknown) => e)) as HttpError;
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(0);
    expect(error.message).toBe(messages.errors.unavailable);
  });
});
