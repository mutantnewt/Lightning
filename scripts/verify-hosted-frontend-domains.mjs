#!/usr/bin/env node

import {
  defaultRegion,
  getAmplifyDomainAssociation,
  getDelegationStatus,
  getHostedFrontendTargets,
  getHttpsStatus,
  getStackOutputs,
  lightningDnsStackName,
  lightningRootDomainName,
  sleep,
} from "./domain-cutover-lib.mjs";

function parseArgs(argv) {
  const args = {
    environmentName: "all",
    domainName: lightningRootDomainName,
    dnsStackName: lightningDnsStackName,
    region: defaultRegion,
    wait: false,
    timeoutMs: 30 * 60 * 1000,
    pollIntervalMs: 15 * 1000,
    requireReady: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--environment":
        args.environmentName = next;
        index += 1;
        break;
      case "--domain":
        args.domainName = next;
        index += 1;
        break;
      case "--dns-stack-name":
        args.dnsStackName = next;
        index += 1;
        break;
      case "--region":
        args.region = next;
        index += 1;
        break;
      case "--wait":
        args.wait = true;
        break;
      case "--timeout-ms":
        args.timeoutMs = Number(next);
        index += 1;
        break;
      case "--poll-interval-ms":
        args.pollIntervalMs = Number(next);
        index += 1;
        break;
      case "--require-ready":
        args.requireReady = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!["staging", "production", "all"].includes(args.environmentName)) {
    throw new Error(
      "--environment must be one of: staging, production, all.",
    );
  }

  return args;
}

function simplifyAssociationError(error) {
  if (!(error instanceof Error)) {
    return String(error ?? "Unknown error");
  }

  const rawMessage = error.message;
  const lines = rawMessage
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const awsMessageLine = lines.find(
    (line) =>
      line.includes("Additional error details:") === false &&
      line.includes("message:"),
  );

  if (awsMessageLine) {
    return awsMessageLine.replace(/^message:\s*/u, "");
  }

  const notFoundLine = lines.find((line) => line.includes("not found"));

  if (notFoundLine) {
    return notFoundLine;
  }

  return lines.at(-1) ?? rawMessage;
}

async function getSingleEnvironmentStatus(target, args) {
  const stackOutputs = getStackOutputs(target.stackName, args.region);
  const appId = stackOutputs.AmplifyAppId ?? null;
  const customDomainName = target.customDomainName;

  if (!appId) {
    return {
      environmentName: target.environmentName,
      stackName: target.stackName,
      customDomainName,
      ready: false,
      error: `Stack ${target.stackName} does not expose AmplifyAppId.`,
    };
  }

  let domainAssociation = null;
  let associationError = null;

  try {
    domainAssociation = getAmplifyDomainAssociation({
      appId,
      domainName: args.domainName,
      region: args.region,
    });
  } catch (error) {
    associationError = simplifyAssociationError(error);
  }

  const domainStatus = domainAssociation?.domainStatus ?? null;
  const updateStatus = domainAssociation?.updateStatus ?? null;
  const certificateRecord =
    domainAssociation?.certificateVerificationDNSRecord ?? null;
  const isApexTarget = target.subdomainPrefix === "";
  const matchingSubDomain =
    domainAssociation?.subDomains?.find(
      (entry) =>
        (entry.subDomainSetting?.prefix ?? "") === target.subdomainPrefix,
    ) ?? null;

  const httpsRoot =
    domainStatus === "AVAILABLE"
      ? await getHttpsStatus(`https://${customDomainName}`)
      : null;
  const httpsFavicon =
    domainStatus === "AVAILABLE"
      ? await getHttpsStatus(`https://${customDomainName}/favicon.svg`)
      : null;
  const subDomainVerificationSatisfied =
    matchingSubDomain?.verified === true ||
    (isApexTarget && domainStatus === "AVAILABLE");

  const ready =
    domainStatus === "AVAILABLE" &&
    subDomainVerificationSatisfied &&
    httpsRoot?.ok === true &&
    httpsFavicon?.ok === true;

  return {
    environmentName: target.environmentName,
    stackName: target.stackName,
    customDomainName,
    appId,
    amplifyDomainStatus: domainStatus,
    amplifyDomainUpdateStatus: updateStatus,
    certificateVerificationDnsRecord: certificateRecord,
    isApexTarget,
    subDomainVerified: matchingSubDomain?.verified ?? null,
    subDomainVerificationSatisfied,
    subDomainDnsRecord: matchingSubDomain?.dnsRecord ?? null,
    httpsRoot,
    httpsFavicon,
    ready,
    error: associationError,
  };
}

async function collectStatuses(targetNames, targets, args) {
  const results = [];

  for (const targetName of targetNames) {
    results.push(await getSingleEnvironmentStatus(targets[targetName], args));
  }

  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const delegationStatus = await getDelegationStatus({
    domainName: args.domainName,
    dnsStackName: args.dnsStackName,
    region: args.region,
  });
  const targets = getHostedFrontendTargets(args.domainName);
  const targetNames =
    args.environmentName === "all"
      ? ["staging", "production"]
      : [args.environmentName];

  const deadline = Date.now() + args.timeoutMs;
  let environmentStatuses = await collectStatuses(targetNames, targets, args);

  while (
    args.wait &&
    Date.now() < deadline &&
    environmentStatuses.some((status) => !status.ready)
  ) {
    await sleep(args.pollIntervalMs);
    environmentStatuses = await collectStatuses(targetNames, targets, args);
  }

  const allReady =
    delegationStatus.delegationMatches &&
    environmentStatuses.every((status) => status.ready);

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        delegationStatus,
        allReady,
        environmentStatuses,
        nextSteps: allReady
          ? [
              "Custom domains are attached and serving over HTTPS.",
              "Run /usr/local/bin/npm run deploy:frontend:production to keep the frontend stack in the deployment graph while removing any temporary production CORS allowances.",
            ]
          : [
              "If registrar delegation is not complete yet, update the nameservers and rerun this verification.",
              "If Amplify domain association is still provisioning, rerun with --wait after attaching the domains.",
            ],
      },
      null,
      2,
    ),
  );

  if (args.requireReady && !allReady) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Hosted-frontend domain verification failed:", error);
  process.exitCode = 1;
});
