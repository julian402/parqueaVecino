import type { EnvironmentConfig } from './types';

export const dev: EnvironmentConfig = {
  name: 'dev',
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  network: { maxAzs: 2, natGateways: 0 },
  monthlyBudgetUsd: 30,
  tags: { project: 'parqueavecino', environment: 'dev' },
};
