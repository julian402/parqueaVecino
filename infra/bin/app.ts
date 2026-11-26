import { App, Tags } from 'aws-cdk-lib';
import { resolveEnvironment } from '../config';
import { NetworkStack } from '../lib/stacks/network-stack';
import { OpsStack } from '../lib/stacks/ops-stack';

const app = new App();
const config = resolveEnvironment(app.node.tryGetContext('env') as string | undefined);
const env = { account: config.account, region: config.region };
const prefix = `ParqueaVecino-${config.name}`;

new NetworkStack(app, `${prefix}-Network`, { env, config });
new OpsStack(app, `${prefix}-Ops`, {
  env,
  config,
  budgetEmail: app.node.tryGetContext('budgetEmail') as string | undefined,
});

// Próximos stacks (Fase 1 y 6): Data, App (ECS Fargate), Edge (CloudFront), Ci (OIDC).

for (const [key, value] of Object.entries(config.tags)) {
  Tags.of(app).add(key, value);
}
