import type { LightningEnvironmentConfig } from "./environment-config";

export type LightningHostedFrontendEnvironmentName = "staging" | "production";

export interface LightningFrontendHostingConfig {
  environmentName: LightningHostedFrontendEnvironmentName;
  stackName: string;
  appName: string;
  branchName: string;
  rootDomainName: string;
  customDomainName: string;
  subdomainPrefix: string;
  repositoryUrlDefault: string;
}

export const lightningDnsStackName = "LightningDnsStack";
export const lightningRootDomainName = "lightningclassics.com";
export const lightningRepositoryUrlDefault =
  "https://github.com/mutantnewt/Lightning";

export function supportsHostedFrontend(
  environmentName: LightningEnvironmentConfig["environmentName"],
): environmentName is LightningHostedFrontendEnvironmentName {
  return environmentName === "staging" || environmentName === "production";
}

export function getLightningFrontendHostingConfig(
  environmentConfig: LightningEnvironmentConfig,
): LightningFrontendHostingConfig | null {
  if (!supportsHostedFrontend(environmentConfig.environmentName)) {
    return null;
  }

  const customDomainName =
    environmentConfig.environmentName === "production"
      ? lightningRootDomainName
      : `staging.${lightningRootDomainName}`;
  const subdomainPrefix =
    environmentConfig.environmentName === "production" ? "" : "staging";
  const branchName =
    environmentConfig.environmentName === "production" ? "main" : "staging";
  const stackName =
    environmentConfig.environmentName === "production"
      ? "LightningProductionFrontendStack"
      : "LightningStagingFrontendStack";

  return {
    environmentName: environmentConfig.environmentName,
    stackName,
    appName: `${environmentConfig.appPrefix}-frontend-${environmentConfig.resourceSuffix}`,
    branchName,
    rootDomainName: lightningRootDomainName,
    customDomainName,
    subdomainPrefix,
    repositoryUrlDefault: lightningRepositoryUrlDefault,
  };
}
