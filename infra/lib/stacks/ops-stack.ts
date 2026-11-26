import { Stack, type StackProps } from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import type { Construct } from 'constructs';
import type { EnvironmentConfig } from '../../config';

export interface OpsStackProps extends StackProps {
  config: EnvironmentConfig;
  /** Correo que recibe la alerta de presupuesto (contexto `-c budgetEmail=...`). */
  budgetEmail?: string;
}

/** Control de costos: alerta al 80 % del presupuesto mensual del ambiente. */
export class OpsStack extends Stack {
  constructor(scope: Construct, id: string, props: OpsStackProps) {
    super(scope, id, props);
    const { config, budgetEmail } = props;

    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `parqueavecino-${config.name}-monthly`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: config.monthlyBudgetUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: budgetEmail
        ? [
            {
              notification: {
                notificationType: 'ACTUAL',
                comparisonOperator: 'GREATER_THAN',
                threshold: 80,
                thresholdType: 'PERCENTAGE',
              },
              subscribers: [{ subscriptionType: 'EMAIL', address: budgetEmail }],
            },
          ]
        : [],
    });
  }
}
