import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema';

function parseEnvFile(path: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

describe('validateEnv', () => {
  const example = parseEnvFile(join(__dirname, '..', '..', '.env.example'));

  it('.env.example es una configuración válida', () => {
    expect(() => validateEnv(example)).not.toThrow();
  });

  it('falla con un mensaje claro si falta una variable', () => {
    const { DATABASE_URL: _omitted, ...rest } = example;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('convierte listas y booleanos', () => {
    const env = validateEnv({ ...example, CORS_ORIGINS: 'http://a.com, http://b.com' });
    expect(env.CORS_ORIGINS).toEqual(['http://a.com', 'http://b.com']);
    expect(env.SWAGGER_ENABLED).toBe(true);
  });
});
