import { RemovalPolicy } from "aws-cdk-lib";

export type LightningEnvironmentName = "local" | "staging" | "production";

export interface LightningEnvironmentConfig {
  environmentName: LightningEnvironmentName;
  resourceSuffix: string;
  stackName: string;
  regionName: string;
  frontendOrigin: string;
  corsAllowedOrigins: string[];
  siteUrl: string;
  appPrefix: string;
  removalPolicy: RemovalPolicy;
  enableDataDeletionProtection: boolean;
  terminationProtection: boolean;
  enableOperationalAlarms: boolean;
}

const defaultRegionName = "eu-west-2";
const defaultAppPrefix = "lightning";

const environmentDefaults: Record<
  LightningEnvironmentName,
  Omit<LightningEnvironmentConfig, "regionName" | "frontendOrigin">
> = {
  local: {
    environmentName: "local",
    resourceSuffix: "local",
    stackName: "LightningLocalStack",
    corsAllowedOrigins: ["http://127.0.0.1:5175"],
    siteUrl: "http://127.0.0.1:5175",
    appPrefix: defaultAppPrefix,
    removalPolicy: RemovalPolicy.DESTROY,
    enableDataDeletionProtection: false,
    terminationProtection: false,
    enableOperationalAlarms: false,
  },
  staging: {
    environmentName: "staging",
    resourceSuffix: "staging",
    stackName: "LightningStagingStack",
    corsAllowedOrigins: ["https://staging.lightningclassics.com"],
    siteUrl: "https://staging.lightningclassics.com",
    appPrefix: defaultAppPrefix,
    removalPolicy: RemovalPolicy.RETAIN,
    enableDataDeletionProtection: true,
    terminationProtection: false,
    enableOperationalAlarms: true,
  },
  production: {
    environmentName: "production",
    resourceSuffix: "prod",
    stackName: "LightningProductionStack",
    corsAllowedOrigins: ["https://lightningclassics.com"],
    siteUrl: "https://lightningclassics.com",
    appPrefix: defaultAppPrefix,
    removalPolicy: RemovalPolicy.RETAIN,
    enableDataDeletionProtection: true,
    terminationProtection: true,
    enableOperationalAlarms: true,
  },
};

function normalizeEnvironmentName(
  value: string | null | undefined,
): LightningEnvironmentName {
  switch (value?.trim().toLowerCase()) {
    case undefined:
    case "":
    case "local":
      return "local";
    case "staging":
    case "stage":
      return "staging";
    case "production":
    case "prod":
      return "production";
    default:
      throw new Error(
        `Unsupported Lightning environment: ${value}. Expected local, staging, or production.`,
      );
  }
}

export function getLightningEnvironmentConfig(options: {
  environmentName?: string | null;
  regionName?: string | null;
  frontendOrigin?: string | null;
  extraCorsOrigins?: string | null;
} = {}): LightningEnvironmentConfig {
  const environmentName = normalizeEnvironmentName(options.environmentName);
  const baseConfig = environmentDefaults[environmentName];
  const regionName = options.regionName?.trim() || defaultRegionName;
  const frontendOrigin =
    options.frontendOrigin?.trim() || baseConfig.siteUrl;
  const extraCorsOrigins = (options.extraCorsOrigins ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsAllowedOrigins = Array.from(
    new Set([
      frontendOrigin,
      ...baseConfig.corsAllowedOrigins,
      ...extraCorsOrigins,
    ]),
  );

  return {
    ...baseConfig,
    regionName,
    frontendOrigin,
    corsAllowedOrigins,
  };
}
