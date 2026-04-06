import {
  Aws,
  CfnOutput,
  Stack,
  type StackProps,
  Tags,
} from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

export interface LightningGithubAutomationStackProps extends StackProps {
  regionName: string;
  repositoryFullName: string;
  appPrefix?: string;
}

interface HostedSmokeRoleConfig {
  environmentName: "staging" | "production";
  resourceSuffix: string;
  environmentStackName: string;
  frontendStackName: string;
  userStateTableName: string;
}

export class LightningGithubAutomationStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: LightningGithubAutomationStackProps,
  ) {
    const {
      regionName,
      repositoryFullName,
      appPrefix = "lightning",
      ...stackProps
    } = props;

    super(scope, id, stackProps);

    Tags.of(this).add("project", "lightning-classics");
    Tags.of(this).add("component", "github-automation");
    Tags.of(this).add("managed-by", "cdk");

    const githubOidcProvider = new iam.OpenIdConnectProvider(
      this,
      "GitHubActionsOidcProvider",
      {
        url: "https://token.actions.githubusercontent.com",
        clientIds: ["sts.amazonaws.com"],
      },
    );

    const stagingRole = this.createHostedSmokeRole(githubOidcProvider, {
      environmentName: "staging",
      resourceSuffix: "staging",
      environmentStackName: "LightningStagingStack",
      frontendStackName: "LightningStagingFrontendStack",
      userStateTableName: `${appPrefix}-user-state-staging`,
    }, repositoryFullName, regionName, appPrefix);

    const productionRole = this.createHostedSmokeRole(githubOidcProvider, {
      environmentName: "production",
      resourceSuffix: "prod",
      environmentStackName: "LightningProductionStack",
      frontendStackName: "LightningProductionFrontendStack",
      userStateTableName: `${appPrefix}-user-state-prod`,
    }, repositoryFullName, regionName, appPrefix);

    new CfnOutput(this, "GitHubOidcProviderArn", {
      value: githubOidcProvider.openIdConnectProviderArn,
    });

    new CfnOutput(this, "GitHubRepositoryFullName", {
      value: repositoryFullName,
    });

    new CfnOutput(this, "GitHubHostedSmokeRoleArnStaging", {
      value: stagingRole.roleArn,
    });

    new CfnOutput(this, "GitHubHostedSmokeRoleArnProduction", {
      value: productionRole.roleArn,
    });
  }

  private createHostedSmokeRole(
    githubOidcProvider: iam.OpenIdConnectProvider,
    config: HostedSmokeRoleConfig,
    repositoryFullName: string,
    regionName: string,
    appPrefix: string,
  ): iam.Role {
    const role = new iam.Role(
      this,
      `${config.environmentName[0].toUpperCase()}${config.environmentName.slice(1)}HostedSmokeRole`,
      {
        roleName: `${appPrefix}-github-actions-hosted-smoke-${config.resourceSuffix}`,
        description: `Least-privilege GitHub Actions hosted smoke role for Lightning Classics ${config.environmentName}.`,
        assumedBy: new iam.WebIdentityPrincipal(
          githubOidcProvider.openIdConnectProviderArn,
          {
            StringEquals: {
              "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
              "token.actions.githubusercontent.com:sub": `repo:${repositoryFullName}:ref:refs/heads/main`,
            },
          },
        ),
      },
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadHostedSmokeStackOutputs",
        actions: ["cloudformation:DescribeStacks"],
        resources: [
          Stack.of(this).formatArn({
            service: "cloudformation",
            region: regionName,
            resource: "stack",
            resourceName: `${config.environmentStackName}/*`,
          }),
          Stack.of(this).formatArn({
            service: "cloudformation",
            region: regionName,
            resource: "stack",
            resourceName: `${config.frontendStackName}/*`,
          }),
        ],
      }),
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadAmplifyDomainAssociation",
        actions: ["amplify:GetDomainAssociation"],
        resources: ["*"],
      }),
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadOperationalStatus",
        actions: [
          "cloudwatch:DescribeAlarms",
          "sns:ListSubscriptionsByTopic",
        ],
        resources: ["*"],
      }),
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "ManageSmokeCommunityProbeState",
        actions: [
          "dynamodb:DeleteItem",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
        ],
        resources: [
          Stack.of(this).formatArn({
            service: "dynamodb",
            region: regionName,
            resource: "table",
            resourceName: config.userStateTableName,
          }),
        ],
      }),
    );

    return role;
  }
}
