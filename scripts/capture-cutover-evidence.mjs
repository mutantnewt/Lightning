#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildHostedFrontendUrlFromOutputs,
  defaultRegion,
  getAmplifyDomainAssociation,
  getDelegationStatus,
  getHostedFrontendRedirectAliases,
  getHostedFrontendTargets,
  getStackOutputs,
  lightningDnsStackName,
  lightningRootDomainName,
  repoRoot,
  run,
} from "./domain-cutover-lib.mjs";

const nodeBin = process.env.NODE_BIN ?? process.execPath;
const smokeScript = path.join(
  repoRoot,
  "scripts",
  "run-hosted-frontend-smoke.mjs",
);
const localFrontendOrigin = "http://127.0.0.1:5175";

function parseArgs(argv) {
  const args = {
    environmentName: "all",
    domainName: lightningRootDomainName,
    dnsStackName: lightningDnsStackName,
    region: defaultRegion,
    runHostedSmoke: false,
    requireHostedSmoke: false,
    smokeTarget: "auto",
    outputPath: "",
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
      case "--run-hosted-smoke":
        args.runHostedSmoke = true;
        break;
      case "--require-hosted-smoke":
        args.runHostedSmoke = true;
        args.requireHostedSmoke = true;
        break;
      case "--smoke-target":
        args.smokeTarget = next;
        index += 1;
        break;
      case "--output":
        args.outputPath = next;
        index += 1;
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

  if (!["auto", "default-amplify", "custom-domain", "url"].includes(args.smokeTarget)) {
    throw new Error(
      "--smoke-target must be one of: auto, default-amplify, custom-domain, url.",
    );
  }

  if (args.smokeTarget === "url") {
    throw new Error(
      "--smoke-target url is not supported here. Use auto, default-amplify, or custom-domain.",
    );
  }

  return args;
}

function simplifyAssociationError(error) {
  if (!(error instanceof Error)) {
    return String(error ?? "Unknown error");
  }

  const lines = error.message
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

  return lines.at(-1) ?? error.message;
}

function getBackendStackName(environmentName) {
  return environmentName === "staging"
    ? "LightningStagingStack"
    : "LightningProductionStack";
}

function splitCsv(value) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function maybeNull(value) {
  return value === undefined ? null : value;
}

function buildSkippedHttpsStatus(reason) {
  return {
    ok: false,
    status: null,
    statusText: null,
    finalUrl: null,
    skipped: true,
    reason,
  };
}

function getHttpsStatusWithCurl(url) {
  try {
    const raw = run("curl", [
      "-sS",
      "-o",
      "/dev/null",
      "-L",
      "--max-time",
      "10",
      "-w",
      "%{http_code} %{url_effective}",
      url,
    ]);
    const trimmed = raw.trim();
    const [statusCodeRaw, ...urlParts] = trimmed.split(" ");
    const statusCode = Number(statusCodeRaw);
    const finalUrl = urlParts.join(" ").trim() || null;

    return {
      ok: Number.isFinite(statusCode) && statusCode >= 200 && statusCode < 400,
      status: Number.isFinite(statusCode) ? statusCode : null,
      statusText: null,
      finalUrl,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      statusText: null,
      finalUrl: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function runHostedSmoke(environmentName, args) {
  const commandArgs = [
    smokeScript,
    "--environment",
    environmentName,
    "--target",
    args.smokeTarget,
    "--domain",
    args.domainName,
    "--region",
    args.region,
  ];
  const commandString = [nodeBin, ...commandArgs].join(" ");

  try {
    run(nodeBin, commandArgs, {
      cwd: repoRoot,
    });

    return {
      status: "passed",
      command: commandString,
    };
  } catch (error) {
    if (args.requireHostedSmoke) {
      throw error;
    }

    return {
      status: "failed",
      command: commandString,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function collectEnvironmentEvidence(environmentName, args) {
  const target = getHostedFrontendTargets(args.domainName)[environmentName];
  const frontendOutputs = getStackOutputs(target.stackName, args.region);
  const backendStackName = getBackendStackName(environmentName);
  const backendOutputs = getStackOutputs(backendStackName, args.region);
  const hostedAmplifyUrl = buildHostedFrontendUrlFromOutputs(frontendOutputs);
  const customDomainUrl = `https://${target.customDomainName}`;
  const redirectAliasDomainNames =
    getHostedFrontendRedirectAliases(args.domainName)[environmentName] ?? [];
  const corsAllowedOrigins = splitCsv(backendOutputs.CorsAllowedOrigins);

  let domainAssociation = null;
  let associationError = null;

  try {
    domainAssociation = getAmplifyDomainAssociation({
      appId: frontendOutputs.AmplifyAppId,
      domainName: args.domainName,
      region: args.region,
    });
  } catch (error) {
    associationError = simplifyAssociationError(error);
  }

  const matchingSubDomain =
    domainAssociation?.subDomains?.find(
      (entry) =>
        (entry.subDomainSetting?.prefix ?? "") === target.subdomainPrefix,
    ) ?? null;
  const isApexTarget = target.subdomainPrefix === "";
  const subDomainVerificationSatisfied =
    matchingSubDomain?.verified === true ||
    (isApexTarget && domainAssociation?.domainStatus === "AVAILABLE");
  const customDomainReady =
    domainAssociation?.domainStatus === "AVAILABLE" &&
    subDomainVerificationSatisfied;
  const shouldProbeCustomDomain = domainAssociation?.domainStatus === "AVAILABLE";

  const hostedHttpsRoot = getHttpsStatusWithCurl(hostedAmplifyUrl);
  const hostedHttpsFavicon = getHttpsStatusWithCurl(
    `${hostedAmplifyUrl}/favicon.svg`,
  );
  const customHttpsRoot = shouldProbeCustomDomain
    ? getHttpsStatusWithCurl(customDomainUrl)
    : buildSkippedHttpsStatus(
        "Custom-domain HTTPS probe skipped because Amplify does not report the domain as AVAILABLE yet.",
      );
  const customHttpsFavicon = shouldProbeCustomDomain
    ? getHttpsStatusWithCurl(`${customDomainUrl}/favicon.svg`)
    : buildSkippedHttpsStatus(
        "Custom-domain favicon probe skipped because Amplify does not report the domain as AVAILABLE yet.",
      );
  const redirectAliasHttps =
    shouldProbeCustomDomain
      ? redirectAliasDomainNames.map((aliasDomainName) => {
          const httpsRoot = getHttpsStatusWithCurl(`https://${aliasDomainName}`);

          return {
            domainName: aliasDomainName,
            expectedFinalUrlPrefix: customDomainUrl,
            httpsRoot,
            redirectsToCanonical:
              httpsRoot.ok === true &&
              (httpsRoot.finalUrl ?? "").startsWith(customDomainUrl),
          };
        })
      : redirectAliasDomainNames.map((aliasDomainName) => ({
          domainName: aliasDomainName,
          expectedFinalUrlPrefix: customDomainUrl,
          httpsRoot: buildSkippedHttpsStatus(
            "Redirect-alias HTTPS probe skipped because Amplify does not report the custom domain as AVAILABLE yet.",
          ),
          redirectsToCanonical: false,
        }));

  return {
    environmentName,
    backendStackName,
    frontendStackName: target.stackName,
    apiBaseUrl: maybeNull(backendOutputs.HttpApiUrl ?? backendOutputs.PublicApiBaseUrl),
    hostedAmplifyUrl,
    customDomainName: target.customDomainName,
    customDomainUrl,
    corsAllowedOrigins,
    temporaryOrigins: {
      localhost5175Present: corsAllowedOrigins.includes(localFrontendOrigin),
      hostedAmplifyOriginPresent: corsAllowedOrigins.includes(hostedAmplifyUrl),
    },
    amplify: {
      appId: maybeNull(frontendOutputs.AmplifyAppId),
      branchName: maybeNull(frontendOutputs.AmplifyBranchName),
      defaultDomain: maybeNull(frontendOutputs.AmplifyDefaultDomain),
      deploymentMode: maybeNull(frontendOutputs.AmplifyDeploymentMode),
      domainAssociation: {
        domainStatus: maybeNull(domainAssociation?.domainStatus),
        updateStatus: maybeNull(domainAssociation?.updateStatus),
        isApexTarget,
        verified: maybeNull(matchingSubDomain?.verified),
        verificationSatisfied: subDomainVerificationSatisfied,
        dnsRecord: maybeNull(matchingSubDomain?.dnsRecord),
        certificateVerificationDnsRecord: maybeNull(
          domainAssociation?.certificateVerificationDNSRecord,
        ),
      },
      associationError,
    },
    https: {
      hostedAmplifyRoot: hostedHttpsRoot,
      hostedAmplifyFavicon: hostedHttpsFavicon,
      customDomainRoot: customHttpsRoot,
      customDomainFavicon: customHttpsFavicon,
      redirectAliases: redirectAliasHttps,
    },
    customDomainReady,
    hostedSmoke: args.runHostedSmoke
      ? runHostedSmoke(environmentName, args)
      : {
          status: "skipped",
        },
  };
}

function buildOutputPath(outputPath) {
  if (outputPath) {
    return outputPath;
  }

  return path.join(
    repoRoot,
    "docs",
    "archive",
    "cutover-evidence",
    `cutover-evidence-${new Date().toISOString().replace(/[:.]/gu, "-")}.json`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const delegationStatus = await getDelegationStatus({
    domainName: args.domainName,
    dnsStackName: args.dnsStackName,
    region: args.region,
  });
  const targetNames =
    args.environmentName === "all"
      ? ["staging", "production"]
      : [args.environmentName];

  const environments = [];

  for (const environmentName of targetNames) {
    environments.push(await collectEnvironmentEvidence(environmentName, args));
  }

  const goLiveReady =
    delegationStatus.delegationMatches &&
    environments.every(
      (environment) =>
        environment.customDomainReady &&
        environment.https.customDomainRoot.ok === true &&
        environment.https.customDomainFavicon.ok === true,
    ) &&
    environments.every((environment) =>
      environment.environmentName === "production"
        ? environment.temporaryOrigins.localhost5175Present === false &&
          environment.temporaryOrigins.hostedAmplifyOriginPresent === false
        : true,
    ) &&
    environments.every((environment) =>
      environment.hostedSmoke.status === "skipped" ||
      environment.hostedSmoke.status === "passed",
    );

  const evidence = {
    observedAt: new Date().toISOString(),
    domainName: args.domainName,
    region: args.region,
    delegationStatus,
    environments,
    goLiveReady,
    nextSteps: goLiveReady
      ? [
          "Custom domains, HTTPS, and production CORS lock-down are all in the expected final state.",
          "Record this evidence artifact with the release notes or operational handoff.",
        ]
      : [
          "If registrar delegation is still pending, update the nameservers to the Route 53 values and rerun the evidence capture.",
          "If the custom domains are attached but not ready, rerun the finalizer or verification workflow after propagation settles.",
          "If production still exposes temporary origins, rerun the final cutover path to remove them.",
        ],
  };

  if (args.outputPath) {
    const outputPath = buildOutputPath(args.outputPath);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    evidence.outputPath = outputPath;
  }

  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => {
  console.error("Cutover evidence capture failed:", error);
  process.exitCode = 1;
});
