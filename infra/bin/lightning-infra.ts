#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { getLightningEnvironmentConfig } from "../lib/environment-config";
import {
  getLightningFrontendHostingConfig,
  lightningDnsStackName,
  lightningRootDomainName,
} from "../lib/frontend-hosting-config";
import { LightningDnsStack } from "../lib/lightning-dns-stack";
import { LightningEnvironmentStack } from "../lib/lightning-environment-stack";
import { LightningFrontendHostingStack } from "../lib/lightning-frontend-hosting-stack";

const app = new cdk.App();
const requestedComponent =
  app.node.tryGetContext("component") ??
  process.env.LIGHTNING_COMPONENT ??
  "backend";

const requestedEnvironment =
  app.node.tryGetContext("environment") ??
  app.node.tryGetContext("envName") ??
  process.env.LIGHTNING_ENV ??
  "local";
const requestedRegion =
  app.node.tryGetContext("region") ??
  process.env.CDK_DEFAULT_REGION ??
  process.env.AWS_REGION ??
  "eu-west-2";
const requestedFrontendOrigin =
  app.node.tryGetContext("frontendOrigin") ??
  process.env.LIGHTNING_FRONTEND_ORIGIN ??
  null;
const requestedExtraCorsOrigins =
  app.node.tryGetContext("extraCorsOrigins") ??
  process.env.LIGHTNING_EXTRA_CORS_ORIGINS ??
  null;
const requestedAlarmNotificationEmails =
  app.node.tryGetContext("alarmNotificationEmails") ??
  process.env.LIGHTNING_ALARM_NOTIFICATION_EMAILS ??
  null;

function parseCsvList(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const account = process.env.CDK_DEFAULT_ACCOUNT;
const alarmNotificationEmails = parseCsvList(requestedAlarmNotificationEmails);

const environmentConfig = getLightningEnvironmentConfig({
  environmentName: requestedEnvironment,
  regionName: requestedRegion,
  frontendOrigin: requestedFrontendOrigin,
  extraCorsOrigins: requestedExtraCorsOrigins,
});

const stackEnv = account
  ? { account, region: environmentConfig.regionName }
  : { region: environmentConfig.regionName };

if (requestedComponent === "dns") {
  new LightningDnsStack(app, lightningDnsStackName, {
    rootDomainName: lightningRootDomainName,
    env: stackEnv,
  });
} else if (requestedComponent === "frontend") {
  const frontendHostingConfig =
    getLightningFrontendHostingConfig(environmentConfig);

  if (!frontendHostingConfig) {
    throw new Error(
      "Frontend hosting is only defined for staging and production environments.",
    );
  }

  const backendStack = new LightningEnvironmentStack(
    app,
    environmentConfig.stackName,
    {
      environmentName: environmentConfig.environmentName,
      resourceSuffix: environmentConfig.resourceSuffix,
      regionName: environmentConfig.regionName,
      frontendOrigin: environmentConfig.frontendOrigin,
      corsAllowedOrigins: environmentConfig.corsAllowedOrigins,
      siteUrl: environmentConfig.siteUrl,
      appPrefix: environmentConfig.appPrefix,
      removalPolicy: environmentConfig.removalPolicy,
      enableDataDeletionProtection:
        environmentConfig.enableDataDeletionProtection,
      enableOperationalAlarms: environmentConfig.enableOperationalAlarms,
      alarmNotificationEmails,
      terminationProtection: environmentConfig.terminationProtection,
      env: stackEnv,
    },
  );

  const frontendStack = new LightningFrontendHostingStack(
    app,
    frontendHostingConfig.stackName,
    {
      environmentName: frontendHostingConfig.environmentName,
      resourceSuffix: environmentConfig.resourceSuffix,
      regionName: environmentConfig.regionName,
      appName: frontendHostingConfig.appName,
      branchName: frontendHostingConfig.branchName,
      siteUrl: environmentConfig.siteUrl,
      rootDomainName: frontendHostingConfig.rootDomainName,
      customDomainName: frontendHostingConfig.customDomainName,
      subdomainPrefix: frontendHostingConfig.subdomainPrefix,
      repositoryUrlDefault: frontendHostingConfig.repositoryUrlDefault,
      apiBaseUrl: backendStack.httpApiUrl,
      cognitoUserPoolId: backendStack.userPoolId,
      cognitoUserPoolClientId: backendStack.userPoolClientId,
      catalogModeratorGroupName: backendStack.catalogModeratorGroupName,
      env: stackEnv,
      terminationProtection: environmentConfig.terminationProtection,
    },
  );
  frontendStack.addDependency(backendStack);
} else {
  new LightningEnvironmentStack(app, environmentConfig.stackName, {
    environmentName: environmentConfig.environmentName,
    resourceSuffix: environmentConfig.resourceSuffix,
    regionName: environmentConfig.regionName,
    frontendOrigin: environmentConfig.frontendOrigin,
    corsAllowedOrigins: environmentConfig.corsAllowedOrigins,
    siteUrl: environmentConfig.siteUrl,
    appPrefix: environmentConfig.appPrefix,
    removalPolicy: environmentConfig.removalPolicy,
    enableDataDeletionProtection: environmentConfig.enableDataDeletionProtection,
    enableOperationalAlarms: environmentConfig.enableOperationalAlarms,
    alarmNotificationEmails,
    terminationProtection: environmentConfig.terminationProtection,
    env: stackEnv,
  });
}
