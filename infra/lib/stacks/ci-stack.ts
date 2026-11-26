import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';
import type { EnvironmentConfig } from '../../config';

export interface CiStackProps extends StackProps {
  config: EnvironmentConfig;
}

const GITHUB_OIDC_URL = 'https://token.actions.githubusercontent.com';

/**
 * Permite que GitHub Actions despliegue con credenciales temporales (OIDC), sin llaves guardadas.
 * Solo la rama de despliegue del repositorio configurado puede asumir el rol.
 */
export class CiStack extends Stack {
  constructor(scope: Construct, id: string, props: CiStackProps) {
    super(scope, id, props);
    const { owner, repo, deployBranch } = props.config.github;

    const provider = new iam.OpenIdConnectProvider(this, 'GitHubOidc', {
      url: GITHUB_OIDC_URL,
      clientIds: ['sts.amazonaws.com'],
    });

    const role = new iam.Role(this, 'GitHubDeployRole', {
      description: `Despliegue desde ${owner}/${repo}@${deployBranch}`,
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': `repo:${owner}/${repo}:ref:refs/heads/${deployBranch}`,
        },
      }),
    });

    // El rol solo puede asumir los roles que creó `cdk bootstrap`; CDK hace el resto.
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*-${this.account}-${this.region}`],
      }),
    );

    new CfnOutput(this, 'DeployRoleArn', { value: role.roleArn });
  }
}
