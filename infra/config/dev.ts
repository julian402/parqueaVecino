import type { EnvironmentConfig } from './types';

export const dev: EnvironmentConfig = {
  name: 'dev',
  account: process.env.CDK_DEFAULT_ACCOUNT,
  // La organización de la cuenta solo permite us-east-2 (SCP); otras regiones son denegadas.
  region: 'us-east-2',
  network: { maxAzs: 2, natGateways: 0 },
  monthlyBudgetUsd: 30,
  tags: { project: 'parqueavecino', environment: 'dev' },
};
