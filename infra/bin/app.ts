import { App, Tags } from 'aws-cdk-lib';
import { resolveEnvironment } from '../config';
import { AppStack } from '../lib/stacks/app-stack';
import { CiStack } from '../lib/stacks/ci-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { NetworkStack } from '../lib/stacks/network-stack';
import { OpsStack } from '../lib/stacks/ops-stack';

const app = new App();
const config = resolveEnvironment(app.node.tryGetContext('env') as string | undefined);
const env = { account: config.account, region: config.region };
const prefix = `ParqueaVecino-${config.name}`;

const network = new NetworkStack(app, `${prefix}-Network`, { env, config });

const data = new DataStack(app, `${prefix}-Data`, {
  env,
  config,
  vpc: network.vpc,
  appSecurityGroup: network.appSecurityGroup,
});

new AppStack(app, `${prefix}-App`, {
  env,
  config,
  vpc: network.vpc,
  appSecurityGroup: network.appSecurityGroup,
  albSecurityGroup: network.albSecurityGroup,
  database: data.database,
});

new CiStack(app, `${prefix}-Ci`, { env, config });

new OpsStack(app, `${prefix}-Ops`, {
  env,
  config,
  budgetEmail: app.node.tryGetContext('budgetEmail') as string | undefined,
});

for (const [key, value] of Object.entries(config.tags)) {
  Tags.of(app).add(key, value);
}
