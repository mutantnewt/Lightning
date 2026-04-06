#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolveNs } from "node:dns/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "..");
export const infraDir = path.join(repoRoot, "infra");
export const awsCli = process.env.AWS_CLI_BIN ?? "aws";
export const npmCli = process.env.NPM_CLI_BIN ?? "npm";
export const lightningRootDomainName = "lightningclassics.com";
export const lightningDnsStackName = "LightningDnsStack";
export const defaultRegion =
  process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? "eu-west-2";

export function run(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    env: {
      ...process.env,
      PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH ?? ""}`,
      ...(options.env ?? {}),
    },
  });
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function normalizeNameServer(value) {
  return value.trim().toLowerCase().replace(/\.+$/u, "");
}

export function uniqueSortedNameServers(values) {
  return [...new Set(values.map(normalizeNameServer).filter(Boolean))].sort();
}

export function getStackOutputs(stackName, region = defaultRegion) {
  const raw = run(awsCli, [
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    stackName,
    "--region",
    region,
  ]);
  const parsed = JSON.parse(raw);

  return Object.fromEntries(
    (parsed.Stacks?.[0]?.Outputs ?? []).map((output) => [
      output.OutputKey,
      output.OutputValue,
    ]),
  );
}

export function buildHostedFrontendUrlFromOutputs(stackOutputs) {
  const branchName = stackOutputs.AmplifyBranchName ?? "";
  const defaultDomain = stackOutputs.AmplifyDefaultDomain ?? "";

  if (!branchName || !defaultDomain) {
    throw new Error(
      "Frontend stack outputs must include AmplifyBranchName and AmplifyDefaultDomain.",
    );
  }

  return `https://${branchName}.${defaultDomain}`;
}

export function getAmplifyDomainAssociation({
  appId,
  domainName = lightningRootDomainName,
  region = defaultRegion,
}) {
  const raw = run(awsCli, [
    "amplify",
    "get-domain-association",
    "--app-id",
    appId,
    "--domain-name",
    domainName,
    "--region",
    region,
  ]);

  return JSON.parse(raw).domainAssociation ?? null;
}

export function getExpectedNameServersFromOutputs(outputs) {
  return uniqueSortedNameServers([
    ...(outputs.HostedZoneNameServers?.split(",") ?? []),
    outputs.HostedZoneNameServer1 ?? "",
    outputs.HostedZoneNameServer2 ?? "",
    outputs.HostedZoneNameServer3 ?? "",
    outputs.HostedZoneNameServer4 ?? "",
  ]);
}

export async function getCurrentDelegatedNameServers(domainName) {
  const currentNameServers = await resolveNs(domainName);
  return uniqueSortedNameServers(currentNameServers);
}

export async function getDelegationStatus({
  domainName = lightningRootDomainName,
  dnsStackName = lightningDnsStackName,
  region = defaultRegion,
} = {}) {
  const stackOutputs = getStackOutputs(dnsStackName, region);
  const expectedNameServers = getExpectedNameServersFromOutputs(stackOutputs);

  if (expectedNameServers.length === 0) {
    throw new Error(
      `Stack ${dnsStackName} does not expose HostedZoneNameServer outputs.`,
    );
  }

  let currentNameServers = [];
  let resolutionError = null;

  try {
    currentNameServers = await getCurrentDelegatedNameServers(domainName);
  } catch (error) {
    resolutionError =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
  }

  const delegationMatches =
    expectedNameServers.length === currentNameServers.length &&
    expectedNameServers.every(
      (nameServer, index) => nameServer === currentNameServers[index],
    );

  return {
    observedAt: new Date().toISOString(),
    domainName,
    dnsStackName,
    region,
    hostedZoneId: stackOutputs.HostedZoneId ?? null,
    expectedNameServers,
    currentNameServers,
    delegationMatches,
    resolutionError,
  };
}

export function getHostedFrontendTargets(
  domainName = lightningRootDomainName,
) {
  return {
    staging: {
      environmentName: "staging",
      stackName: "LightningStagingFrontendStack",
      deployScript: "deploy:frontend:staging",
      customDomainName: `staging.${domainName}`,
      subdomainPrefix: "staging",
    },
    production: {
      environmentName: "production",
      stackName: "LightningProductionFrontendStack",
      deployScript: "deploy:frontend:production",
      customDomainName: domainName,
      subdomainPrefix: "",
    },
  };
}

export async function getHttpsStatus(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 10_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method ?? "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      finalUrl: response.url,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      statusText: null,
      finalUrl: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}
