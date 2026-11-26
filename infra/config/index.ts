import { prod } from './prod';
import type { EnvironmentConfig } from './types';

const environments: Record<string, EnvironmentConfig> = { prod };

/** Ambiente elegido con `cdk deploy -c env=<nombre>` (por defecto `prod`). */
export function resolveEnvironment(name: string | undefined): EnvironmentConfig {
  const config = environments[name ?? 'prod'];
  if (!config) {
    throw new Error(
      `Ambiente desconocido "${name}". Disponibles: ${Object.keys(environments).join(', ')}`,
    );
  }
  return config;
}

export type { EnvironmentConfig } from './types';
