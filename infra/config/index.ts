import { dev } from './dev';
import type { EnvironmentConfig } from './types';

const environments: Record<string, EnvironmentConfig> = { dev };

/** Ambiente elegido con `cdk deploy -c env=<nombre>` (por defecto `dev`). */
export function resolveEnvironment(name: string | undefined): EnvironmentConfig {
  const config = environments[name ?? 'dev'];
  if (!config) {
    throw new Error(
      `Ambiente desconocido "${name}". Disponibles: ${Object.keys(environments).join(', ')}`,
    );
  }
  return config;
}

export type { EnvironmentConfig } from './types';
