/** Parámetros de infraestructura por ambiente. Nada de tamaños quemados en los stacks. */
export interface EnvironmentConfig {
  /** Nombre corto del ambiente: se usa como prefijo de recursos. */
  name: string;
  /** Cuenta y región de AWS (se leen del perfil/CI si no se especifican). */
  account?: string;
  region: string;
  network: {
    maxAzs: number;
    /** 0 = sin NAT Gateway (ahorra ~USD 32/mes en dev). */
    natGateways: number;
  };
  /** Alerta de AWS Budgets, en USD por mes. */
  monthlyBudgetUsd: number;
  tags: Record<string, string>;
}
