#!/usr/bin/env node

import {
  buildHostedFrontendUrlFromOutputs,
  defaultRegion,
  getAmplifyDomainAssociation,
  getHostedFrontendTargets,
  getStackOutputs,
  lightningRootDomainName,
} from "./domain-cutover-lib.mjs";

const releaseManifestFileName = "lightning-release.json";

function parseArgs(argv) {
  const args = {
    environmentName: "all",
    targetMode: "auto",
    explicitUrl: process.env.LIGHTNING_HOSTED_RELEASE_URL ?? "",
    region: defaultRegion,
    domainName: lightningRootDomainName,
    requireMatch: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--environment":
        args.environmentName = next;
        index += 1;
        break;
      case "--target":
        args.targetMode = next;
        index += 1;
        break;
      case "--url":
        args.explicitUrl = next;
        index += 1;
        break;
      case "--region":
        args.region = next;
        index += 1;
        break;
      case "--domain":
        args.domainName = next;
        index += 1;
        break;
      case "--require-match":
        args.requireMatch = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!["all", "staging", "production"].includes(args.environmentName)) {
    throw new Error("--environment must be one of: all, staging, production.");
  }

  if (!["auto", "default-amplify", "custom-domain", "url"].includes(args.targetMode)) {
    throw new Error(
      "--target must be one of: auto, default-amplify, custom-domain, url.",
    );
  }

  if (args.environmentName === "all" && args.targetMode === "url") {
    throw new Error("--target url requires a single environment.");
  }

  if (args.targetMode === "url" && !args.explicitUrl) {
    throw new Error("--target url requires --url or LIGHTNING_HOSTED_RELEASE_URL.");
  }

  return args;
}

function getCustomDomainState(target, domainAssociation) {
  const matchingSubDomain =
    domainAssociation?.subDomains?.find(
      (entry) =>
        (entry.subDomainSetting?.prefix ?? "") === target.subdomainPrefix,
    ) ?? null;
  const isApexTarget = target.subdomainPrefix === "";
  const domainStatus = domainAssociation?.domainStatus ?? null;
  const verified = matchingSubDomain?.verified ?? false;
  const verificationSatisfied =
    verified || (isApexTarget && domainStatus === "AVAILABLE");

  return {
    domainStatus,
    updateStatus: domainAssociation?.updateStatus ?? null,
    verified,
    isApexTarget,
    verificationSatisfied,
  };
}

function resolveTarget(environmentName, args) {
  if (args.targetMode === "url") {
    return {
      smokeUrl: args.explicitUrl,
      selectedTarget: "url",
      fallbackReason: null,
      stackOutputs: null,
      customDomainState: null,
      target: null,
    };
  }

  const target = getHostedFrontendTargets(args.domainName)[environmentName];
  const stackOutputs = getStackOutputs(target.stackName, args.region);
  const amplifyUrl = buildHostedFrontendUrlFromOutputs(stackOutputs);
  let domainAssociation = null;

  try {
    domainAssociation = getAmplifyDomainAssociation({
      appId: stackOutputs.AmplifyAppId,
      domainName: args.domainName,
      region: args.region,
    });
  } catch {
    domainAssociation = null;
  }

  const customDomainState = getCustomDomainState(target, domainAssociation);
  const customDomainReady =
    customDomainState.domainStatus === "AVAILABLE" &&
    customDomainState.verificationSatisfied === true;
  const customDomainUrl = `https://${target.customDomainName}`;

  if (args.targetMode === "custom-domain") {
    if (!customDomainReady) {
      throw new Error(
        [
          `Custom domain is not ready for ${environmentName}.`,
          `domainStatus=${customDomainState.domainStatus ?? "null"}`,
          `verified=${String(customDomainState.verified)}`,
        ].join(" "),
      );
    }

    return {
      smokeUrl: customDomainUrl,
      selectedTarget: "custom-domain",
      fallbackReason: null,
      stackOutputs,
      customDomainState,
      target,
    };
  }

  if (args.targetMode === "default-amplify") {
    return {
      smokeUrl: amplifyUrl,
      selectedTarget: "default-amplify",
      fallbackReason: null,
      stackOutputs,
      customDomainState,
      target,
    };
  }

  return {
    smokeUrl: customDomainReady ? customDomainUrl : amplifyUrl,
    selectedTarget: customDomainReady ? "custom-domain" : "default-amplify",
    fallbackReason: customDomainReady
      ? null
      : "Custom domain is not ready yet, so release status uses the default Amplify domain.",
    stackOutputs,
    customDomainState,
    target,
  };
}

async function fetchReleaseManifest(url) {
  const response = await fetch(`${url.replace(/\/$/u, "")}/${releaseManifestFileName}`);
  const bodyText = await response.text();

  let parsedBody = null;

  if (bodyText) {
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      parsedBody = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    release: parsedBody,
    bodyText: parsedBody ? null : bodyText,
  };
}

function buildChecks(environmentName, resolution, release) {
  const stackOutputs = resolution.stackOutputs ?? {};
  const runtime = release?.runtime ?? {};
  const hosting = release?.hosting ?? {};

  const checks = {
    environmentMatches: release?.environmentName === environmentName,
    apiBaseUrlMatches:
      runtime.apiPublicBaseUrl === (stackOutputs.FrontendApiBaseUrl ?? null),
    siteUrlMatches: runtime.siteUrl === (stackOutputs.FrontendSiteUrl ?? null),
    userPoolIdMatches:
      runtime.cognitoUserPoolId ===
      (stackOutputs.FrontendCognitoUserPoolId ?? null),
    userPoolClientIdMatches:
      runtime.cognitoUserPoolClientId ===
      (stackOutputs.FrontendCognitoUserPoolClientId ?? null),
    moderatorGroupMatches:
      runtime.catalogModeratorGroupName ===
      (stackOutputs.FrontendCatalogModeratorGroupName ?? null),
    defaultDomainMatches:
      hosting.amplifyDefaultDomain === (stackOutputs.AmplifyDefaultDomain ?? null),
  };

  return {
    ...checks,
    allMatch: Object.values(checks).every(Boolean),
  };
}

async function getEnvironmentReleaseStatus(environmentName, args) {
  const resolution = resolveTarget(environmentName, args);
  const fetchResult = await fetchReleaseManifest(resolution.smokeUrl);
  const checks =
    fetchResult.ok && fetchResult.release
      ? buildChecks(environmentName, resolution, fetchResult.release)
      : null;

  return {
    observedAt: new Date().toISOString(),
    environmentName,
    targetMode: args.targetMode,
    selectedTarget: resolution.selectedTarget,
    fallbackReason: resolution.fallbackReason,
    releaseUrl: `${resolution.smokeUrl.replace(/\/$/u, "")}/${releaseManifestFileName}`,
    amplifyAppId: resolution.stackOutputs?.AmplifyAppId ?? null,
    amplifyBranchName: resolution.stackOutputs?.AmplifyBranchName ?? null,
    amplifyDefaultDomain: resolution.stackOutputs?.AmplifyDefaultDomain ?? null,
    customDomainState: resolution.customDomainState,
    fetch: {
      ok: fetchResult.ok,
      status: fetchResult.status,
      statusText: fetchResult.statusText,
      finalUrl: fetchResult.url,
    },
    checks,
    release: fetchResult.release,
    error:
      fetchResult.ok || fetchResult.release
        ? null
        : fetchResult.bodyText || "Unable to parse release manifest.",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const environmentNames =
    args.environmentName === "all"
      ? ["staging", "production"]
      : [args.environmentName];

  const results = [];

  for (const environmentName of environmentNames) {
    results.push(await getEnvironmentReleaseStatus(environmentName, args));
  }

  const summary = {
    observedAt: new Date().toISOString(),
    requireMatch: args.requireMatch,
    allFetchOk: results.every((result) => result.fetch.ok),
    allMatch: results.every((result) => result.checks?.allMatch ?? false),
  };

  const payload = {
    ...summary,
    results,
  };

  console.log(JSON.stringify(payload, null, 2));

  if (args.requireMatch && (!summary.allFetchOk || !summary.allMatch)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    "Hosted frontend release status failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
