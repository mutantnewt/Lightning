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
  userPoolArnPattern: string;
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
      userPoolArnPattern: Stack.of(this).formatArn({
        service: "cognito-idp",
        region: regionName,
        resource: "userpool",
        resourceName: "*",
      }),
    }, repositoryFullName, regionName, appPrefix);

    const productionRole = this.createHostedSmokeRole(githubOidcProvider, {
      environmentName: "production",
      resourceSuffix: "prod",
      environmentStackName: "LightningProductionStack",
      frontendStackName: "LightningProductionFrontendStack",
      userStateTableName: `${appPrefix}-user-state-prod`,
      userPoolArnPattern: Stack.of(this).formatArn({
        service: "cognito-idp",
        region: regionName,
        resource: "userpool",
        resourceName: "*",
      }),
    }, repositoryFullName, regionName, appPrefix);

    const operationsReadRole = this.createOperationsReadRole(
      githubOidcProvider,
      repositoryFullName,
      regionName,
      appPrefix,
    );
    const alertingManageRole = this.createAlertingManageRole(
      githubOidcProvider,
      repositoryFullName,
      regionName,
      appPrefix,
    );
    const frontendReleaseRole = this.createFrontendReleaseRole(
      githubOidcProvider,
      repositoryFullName,
      regionName,
      appPrefix,
    );

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

    new CfnOutput(this, "GitHubOperationsReadRoleArn", {
      value: operationsReadRole.roleArn,
    });

    new CfnOutput(this, "GitHubAlertingManageRoleArn", {
      value: alertingManageRole.roleArn,
    });

    new CfnOutput(this, "GitHubFrontendReleaseRoleArn", {
      value: frontendReleaseRole.roleArn,
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
          "dynamodb:UpdateItem",
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

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "BootstrapHostedSmokeUsers",
        actions: [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:ListUsers",
        ],
        resources: [config.userPoolArnPattern],
      }),
    );

    return role;
  }

  private createOperationsReadRole(
    githubOidcProvider: iam.OpenIdConnectProvider,
    repositoryFullName: string,
    regionName: string,
    appPrefix: string,
  ): iam.Role {
    const role = new iam.Role(this, "OperationsReadRole", {
      roleName: `${appPrefix}-github-actions-operations-read`,
      description:
        "Read-only GitHub Actions operations role for Lightning Classics evidence and status workflows.",
      assumedBy: new iam.WebIdentityPrincipal(
        githubOidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": `repo:${repositoryFullName}:ref:refs/heads/main`,
          },
        },
      ),
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadOperationsAndCutoverStacks",
        actions: ["cloudformation:DescribeStacks"],
        resources: [
          Stack.of(this).formatArn({
            service: "cloudformation",
            region: regionName,
            resource: "stack",
            resourceName: "LightningDnsStack/*",
          }),
          Stack.of(this).formatArn({
            service: "cloudformation",
            region: regionName,
            resource: "stack",
            resourceName: "LightningStagingStack/*",
          }),
          Stack.of(this).formatArn({
            service: "cloudformation",
            region: regionName,
            resource: "stack",
            resourceName: "LightningProductionStack/*",
          }),
          Stack.of(this).formatArn({
            service: "cloudformation",
            region: regionName,
            resource: "stack",
            resourceName: "LightningStagingFrontendStack/*",
          }),
          Stack.of(this).formatArn({
            service: "cloudformation",
            region: regionName,
            resource: "stack",
            resourceName: "LightningProductionFrontendStack/*",
          }),
          Stack.of(this).formatArn({
            service: "cloudformation",
            region: regionName,
            resource: "stack",
            resourceName: "LightningGithubAutomationStack/*",
          }),
        ],
      }),
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadAmplifyAndAlarmState",
        actions: [
          "amplify:GetDomainAssociation",
          "cloudwatch:DescribeAlarms",
          "sns:ListSubscriptionsByTopic",
        ],
        resources: ["*"],
      }),
    );

    return role;
  }

  private createAlertingManageRole(
    githubOidcProvider: iam.OpenIdConnectProvider,
    repositoryFullName: string,
    regionName: string,
    appPrefix: string,
  ): iam.Role {
    const role = new iam.Role(this, "AlertingManageRole", {
      roleName: `${appPrefix}-github-actions-alerting-manage`,
      description:
        "GitHub Actions alerting-management role for Lightning Classics SNS alarm subscription automation.",
      assumedBy: new iam.WebIdentityPrincipal(
        githubOidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": `repo:${repositoryFullName}:ref:refs/heads/main`,
          },
        },
      ),
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadAlertingStacks",
        actions: ["cloudformation:DescribeStacks"],
        resources: [
          Stack.of(this).formatArn({
            service: "cloudformation",
            region: regionName,
            resource: "stack",
            resourceName: "LightningStagingStack/*",
          }),
          Stack.of(this).formatArn({
            service: "cloudformation",
            region: regionName,
            resource: "stack",
            resourceName: "LightningProductionStack/*",
          }),
        ],
      }),
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadAndAttachAlarmSubscriptions",
        actions: [
          "cloudwatch:DescribeAlarms",
          "sns:ListSubscriptionsByTopic",
          "sns:Subscribe",
        ],
        resources: ["*"],
      }),
    );

    return role;
  }

  private createFrontendReleaseRole(
    githubOidcProvider: iam.OpenIdConnectProvider,
    repositoryFullName: string,
    regionName: string,
    appPrefix: string,
  ): iam.Role {
    const role = new iam.Role(this, "FrontendReleaseRole", {
      roleName: `${appPrefix}-github-actions-frontend-release`,
      description:
        "GitHub Actions frontend-release role for Lightning Classics manual hosted frontend publishes.",
      assumedBy: new iam.WebIdentityPrincipal(
        githubOidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": `repo:${repositoryFullName}:ref:refs/heads/main`,
          },
        },
      ),
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadFrontendStacks",
        actions: ["cloudformation:DescribeStacks"],
        resources: [
          Stack.of(this).formatArn({
            service: "cloudformation",
            region: regionName,
            resource: "stack",
            resourceName: "LightningStagingFrontendStack/*",
          }),
          Stack.of(this).formatArn({
            service: "cloudformation",
            region: regionName,
            resource: "stack",
            resourceName: "LightningProductionFrontendStack/*",
          }),
        ],
      }),
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "ManageFrontendAmplifyDeployments",
        actions: [
          "amplify:CreateDeployment",
          "amplify:StartDeployment",
          "amplify:GetJob",
          "amplify:GetDomainAssociation",
        ],
        resources: ["*"],
      }),
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: "WriteFrontendReleaseArchives",
        actions: ["s3:PutObject"],
        resources: [
          `arn:${Aws.PARTITION}:s3:::${appPrefix}-frontend-releases-staging-${Aws.ACCOUNT_ID}-${regionName}/*`,
          `arn:${Aws.PARTITION}:s3:::${appPrefix}-frontend-releases-prod-${Aws.ACCOUNT_ID}-${regionName}/*`,
        ],
      }),
    );

    return role;
  }
}
