#!/usr/bin/env node

import {
  buildHostedFrontendUrlFromOutputs,
  defaultRegion,
  getAmplifyDomainAssociation,
  getDelegationStatus,
  getHostedFrontendTargets,
  getStackOutputs,
  lightningDnsStackName,
  lightningRootDomainName,
} from "./domain-cutover-lib.mjs";

function parseArgs(argv) {
  const args = {
    domainName: lightningRootDomainName,
    dnsStackName: lightningDnsStackName,
    region: defaultRegion,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
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
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  return args;
}

function listOrigins(value) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getDomainAssociationSummary(domainAssociation, target) {
  const matchingSubDomain =
    domainAssociation?.subDomains?.find(
      (entry) =>
        (entry.subDomainSetting?.prefix ?? "") === target.subdomainPrefix,
    ) ?? null;
  const isApexTarget = target.subdomainPrefix === "";
  const domainStatus = domainAssociation?.domainStatus ?? null;
  const verified = matchingSubDomain?.verified ?? null;
  const verificationSatisfied =
    verified === true || (isApexTarget && domainStatus === "AVAILABLE");

  return {
    domainStatus,
    updateStatus: domainAssociation?.updateStatus ?? null,
    isApexTarget,
    verified,
    verificationSatisfied,
    dnsRecord: matchingSubDomain?.dnsRecord ?? null,
    certificateVerificationDnsRecord:
      domainAssociation?.certificateVerificationDNSRecord ?? null,
  };
}

function safeGetDomainAssociation(appId, domainName, region) {
  try {
    return getAmplifyDomainAssociation({
      appId,
      domainName,
      region,
    });
  } catch {
    return null;
  }
}

function getEnvironmentStatus(environmentName, args) {
  const frontendTarget = getHostedFrontendTargets(args.domainName)[environmentName];
  const frontendOutputs = getStackOutputs(frontendTarget.stackName, args.region);
  const backendStackName =
    environmentName === "production"
      ? "LightningProductionStack"
      : "LightningStagingStack";
  const backendOutputs = getStackOutputs(backendStackName, args.region);
  const hostedAmplifyUrl = buildHostedFrontendUrlFromOutputs(frontendOutputs);
  const domainAssociation = safeGetDomainAssociation(
    frontendOutputs.AmplifyAppId,
    args.domainName,
    args.region,
  );

  return {
    environmentName,
    backendStackName,
    frontendStackName: frontendTarget.stackName,
    apiBaseUrl: backendOutputs.HttpApiUrl ?? null,
    customDomainName: frontendTarget.customDomainName,
    hostedAmplifyUrl,
    corsAllowedOrigins: listOrigins(backendOutputs.CorsAllowedOrigins ?? ""),
    amplify: {
      appId: frontendOutputs.AmplifyAppId ?? null,
      branchName: frontendOutputs.AmplifyBranchName ?? null,
      defaultDomain: frontendOutputs.AmplifyDefaultDomain ?? null,
      deploymentMode: frontendOutputs.FrontendDeploymentMode ?? null,
      domainAssociation: getDomainAssociationSummary(
        domainAssociation,
        frontendTarget,
      ),
    },
    smoke: {
      hostedCommand:
        environmentName === "production"
          ? "cd /Users/steve/Documents/GitHub/Lightning/literary-light && LIGHTNING_SMOKE_IDENTIFIER=lightning-production-smoke@example.com LIGHTNING_SMOKE_PASSWORD='your-production-smoke-password' /usr/local/bin/npm run smoke:production:hosted"
          : "cd /Users/steve/Documents/GitHub/Lightning/literary-light && LIGHTNING_SMOKE_IDENTIFIER=lightning-staging-smoke@example.com LIGHTNING_SMOKE_PASSWORD='your-staging-smoke-password' /usr/local/bin/npm run smoke:staging:hosted",
      customDomainFinalizerEnvVars:
        environmentName === "production"
          ? [
              "LIGHTNING_PRODUCTION_SMOKE_IDENTIFIER",
              "LIGHTNING_PRODUCTION_SMOKE_PASSWORD",
            ]
          : [
              "LIGHTNING_STAGING_SMOKE_IDENTIFIER",
              "LIGHTNING_STAGING_SMOKE_PASSWORD",
            ],
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const delegationStatus = await getDelegationStatus({
    domainName: args.domainName,
    dnsStackName: args.dnsStackName,
    region: args.region,
  });

  const staging = getEnvironmentStatus("staging", args);
  const production = getEnvironmentStatus("production", args);

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        domainName: args.domainName,
        region: args.region,
        hostedZoneId: delegationStatus.hostedZoneId,
        registrar: {
          currentNameServers: delegationStatus.currentNameServers,
          expectedRoute53NameServers: delegationStatus.expectedNameServers,
          delegationMatches: delegationStatus.delegationMatches,
        },
        staging,
        production,
        nextStep: delegationStatus.delegationMatches
          ? "Run /usr/local/bin/npm run cutover:finalize:with-hosted-smoke from infra/."
          : "Update the registrar nameservers to the expected Route 53 values, wait for delegation to settle, then run /usr/local/bin/npm run cutover:finalize:with-hosted-smoke from infra/.",
        finalCutoverCommand:
          "cd /Users/steve/Documents/GitHub/Lightning/infra && /usr/local/bin/npm run cutover:finalize:with-hosted-smoke",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Cutover status report failed:", error);
  process.exitCode = 1;
});
