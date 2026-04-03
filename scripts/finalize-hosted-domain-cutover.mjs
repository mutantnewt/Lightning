#!/usr/bin/env node

import path from "node:path";
import {
  buildHostedFrontendUrlFromOutputs,
  defaultRegion,
  getDelegationStatus,
  getStackOutputs,
  infraDir,
  lightningDnsStackName,
  lightningRootDomainName,
  npmCli,
  repoRoot,
  run,
} from "./domain-cutover-lib.mjs";

const nodeBin = process.env.NODE_BIN ?? process.execPath;
const localFrontendOrigin = "http://127.0.0.1:5175";
const attachScript = path.join(
  repoRoot,
  "scripts",
  "attach-hosted-frontend-domains.mjs",
);
const verifyScript = path.join(
  repoRoot,
  "scripts",
  "verify-hosted-frontend-domains.mjs",
);
const hostedSmokeScript = path.join(
  repoRoot,
  "scripts",
  "run-hosted-frontend-smoke.mjs",
);

function parseArgs(argv) {
  const args = {
    domainName: lightningRootDomainName,
    dnsStackName: lightningDnsStackName,
    region: defaultRegion,
    deploymentMode: "MANUAL",
    accessToken: process.env.AMPLIFY_ACCESS_TOKEN ?? "",
    customCertificateArn: process.env.AMPLIFY_CUSTOM_CERTIFICATE_ARN ?? "",
    timeoutMs: 30 * 60 * 1000,
    pollIntervalMs: 15 * 1000,
    skipAttach: false,
    skipVerify: false,
    skipProductionLockdown: false,
    runHostedSmoke: false,
    requireHostedSmoke: false,
    allowDelegationMismatch: false,
    dryRun: false,
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
      case "--deployment-mode":
        args.deploymentMode = next;
        index += 1;
        break;
      case "--access-token":
        args.accessToken = next;
        index += 1;
        break;
      case "--custom-certificate-arn":
        args.customCertificateArn = next;
        index += 1;
        break;
      case "--timeout-ms":
        args.timeoutMs = Number(next);
        index += 1;
        break;
      case "--poll-interval-ms":
        args.pollIntervalMs = Number(next);
        index += 1;
        break;
      case "--skip-attach":
        args.skipAttach = true;
        break;
      case "--skip-verify":
        args.skipVerify = true;
        break;
      case "--skip-production-lockdown":
        args.skipProductionLockdown = true;
        break;
      case "--run-hosted-smoke":
        args.runHostedSmoke = true;
        break;
      case "--require-hosted-smoke":
        args.runHostedSmoke = true;
        args.requireHostedSmoke = true;
        break;
      case "--allow-delegation-mismatch":
        args.allowDelegationMismatch = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!["MANUAL", "REPOSITORY"].includes(args.deploymentMode)) {
    throw new Error(
      "--deployment-mode must be either MANUAL or REPOSITORY.",
    );
  }

  if (args.deploymentMode === "REPOSITORY" && !args.accessToken) {
    throw new Error(
      "REPOSITORY deployment mode requires --access-token or AMPLIFY_ACCESS_TOKEN.",
    );
  }

  return args;
}

function buildAttachArgs(args) {
  const attachArgs = [
    attachScript,
    "--environment",
    "all",
    "--domain",
    args.domainName,
    "--dns-stack-name",
    args.dnsStackName,
    "--region",
    args.region,
    "--deployment-mode",
    args.deploymentMode,
  ];

  if (args.accessToken) {
    attachArgs.push("--access-token", args.accessToken);
  }

  if (args.customCertificateArn) {
    attachArgs.push("--custom-certificate-arn", args.customCertificateArn);
  }

  if (args.allowDelegationMismatch) {
    attachArgs.push("--allow-delegation-mismatch");
  }

  return attachArgs;
}

function buildVerifyArgs(args) {
  return [
    verifyScript,
    "--environment",
    "all",
    "--domain",
    args.domainName,
    "--dns-stack-name",
    args.dnsStackName,
    "--region",
    args.region,
    "--wait",
    "--require-ready",
    "--timeout-ms",
    String(args.timeoutMs),
    "--poll-interval-ms",
    String(args.pollIntervalMs),
  ];
}

function runNodeJson(scriptArgs) {
  const raw = run(nodeBin, scriptArgs, {
    cwd: repoRoot,
  });

  return JSON.parse(raw);
}

function resolveHostedSmokeCredentials(environmentName) {
  const upperEnvironmentName = environmentName.toUpperCase();
  const identifier =
    process.env[`LIGHTNING_${upperEnvironmentName}_SMOKE_IDENTIFIER`] ??
    process.env.LIGHTNING_SMOKE_IDENTIFIER ??
    null;
  const password =
    process.env[`LIGHTNING_${upperEnvironmentName}_SMOKE_PASSWORD`] ??
    process.env.LIGHTNING_SMOKE_PASSWORD ??
    null;

  return {
    identifier,
    password,
    present: Boolean(identifier && password),
  };
}

function buildHostedSmokeArgs(environmentName, args) {
  return [
    hostedSmokeScript,
    "--environment",
    environmentName,
    "--target",
    "custom-domain",
    "--domain",
    args.domainName,
    "--region",
    args.region,
  ];
}

function runWithInheritedOutput(command, commandArgs, cwd) {
  run(command, commandArgs, {
    cwd,
    stdio: "inherit",
  });
}

function assertProductionCorsLockedDown(region) {
  const outputs = getStackOutputs("LightningProductionStack", region);
  const corsAllowedOrigins = (outputs.CorsAllowedOrigins ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const productionFrontendOutputs = getStackOutputs(
    "LightningProductionFrontendStack",
    region,
  );
  const hostedAmplifyUrl = buildHostedFrontendUrlFromOutputs(
    productionFrontendOutputs,
  );

  if (
    corsAllowedOrigins.includes(localFrontendOrigin) ||
    corsAllowedOrigins.includes(hostedAmplifyUrl)
  ) {
    throw new Error(
      [
        "Production CORS still includes temporary pre-cutover frontend origins after the cleanup deploy.",
        `CorsAllowedOrigins: ${corsAllowedOrigins.join(", ")}`,
      ].join("\n"),
    );
  }

  return {
    corsAllowedOrigins,
    localFrontendOriginRemoved: true,
    hostedAmplifyOriginRemoved: true,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const delegationStatus = await getDelegationStatus({
    domainName: args.domainName,
    dnsStackName: args.dnsStackName,
    region: args.region,
  });

  if (
    !delegationStatus.delegationMatches &&
    !args.allowDelegationMismatch &&
    !args.dryRun
  ) {
    throw new Error(
      [
        `Registrar delegation for ${args.domainName} does not match the Route 53 hosted zone yet.`,
        `Expected: ${delegationStatus.expectedNameServers.join(", ")}`,
        `Current: ${delegationStatus.currentNameServers.join(", ") || "(none resolved)"}`,
        "Update the registrar nameservers and rerun this finalizer.",
      ].join("\n"),
    );
  }

  const steps = [];

  if (!args.skipAttach) {
    const attachArgs = buildAttachArgs(args);

    if (args.dryRun) {
      steps.push({
        step: "attachDomains",
        status: "planned",
        command: [nodeBin, ...attachArgs].join(" "),
      });
    } else {
      runWithInheritedOutput(nodeBin, attachArgs, repoRoot);
      steps.push({
        step: "attachDomains",
        status: "completed",
      });
    }
  } else {
    steps.push({
      step: "attachDomains",
      status: "skipped",
    });
  }

  let verificationResult = null;

  if (!args.skipVerify) {
    const verifyArgs = buildVerifyArgs(args);

    if (args.dryRun) {
      steps.push({
        step: "verifyDomains",
        status: "planned",
        command: [nodeBin, ...verifyArgs].join(" "),
      });
    } else {
      verificationResult = runNodeJson(verifyArgs);
      steps.push({
        step: "verifyDomains",
        status: "completed",
        allReady: verificationResult.allReady,
      });
    }
  } else {
    steps.push({
      step: "verifyDomains",
      status: "skipped",
    });
  }

  let productionLockdownResult = null;

  if (!args.skipProductionLockdown) {
    if (args.dryRun) {
      steps.push({
        step: "deployProductionLockdown",
        status: "planned",
        command: `${npmCli} run deploy:frontend:production`,
      });
    } else {
      runWithInheritedOutput(
        npmCli,
        ["run", "deploy:frontend:production"],
        infraDir,
      );
      productionLockdownResult = assertProductionCorsLockedDown(args.region);
      steps.push({
        step: "deployProductionLockdown",
        status: "completed",
        corsAllowedOrigins: productionLockdownResult.corsAllowedOrigins,
      });
    }
  } else {
    steps.push({
      step: "deployProductionLockdown",
      status: "skipped",
    });
  }

  const hostedSmokeResults = [];

  if (args.runHostedSmoke) {
    for (const environmentName of ["staging", "production"]) {
      const credentials = resolveHostedSmokeCredentials(environmentName);
      const hostedSmokeArgs = buildHostedSmokeArgs(environmentName, args);

      if (!credentials.present) {
        const missingCredentialResult = {
          environmentName,
          status: args.requireHostedSmoke ? "blocked" : "skipped",
          reason:
            `Missing LIGHTNING_${environmentName.toUpperCase()}_SMOKE_IDENTIFIER and/or LIGHTNING_${environmentName.toUpperCase()}_SMOKE_PASSWORD.`,
          command: [nodeBin, ...hostedSmokeArgs].join(" "),
        };

        hostedSmokeResults.push(missingCredentialResult);

        if (args.requireHostedSmoke && !args.dryRun) {
          throw new Error(missingCredentialResult.reason);
        }

        continue;
      }

      if (args.dryRun) {
        hostedSmokeResults.push({
          environmentName,
          status: "planned",
          command: [nodeBin, ...hostedSmokeArgs].join(" "),
        });
        continue;
      }

      runWithInheritedOutput(nodeBin, hostedSmokeArgs, repoRoot);
      hostedSmokeResults.push({
        environmentName,
        status: "completed",
      });
    }

    steps.push({
      step: "runHostedSmoke",
      status: hostedSmokeResults.every(
        (result) => result.status === "completed" || result.status === "planned",
      )
        ? args.dryRun
          ? "planned"
          : "completed"
        : args.requireHostedSmoke
          ? "blocked"
          : "partial",
      results: hostedSmokeResults,
    });
  } else {
    steps.push({
      step: "runHostedSmoke",
      status: "skipped",
    });
  }

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        dryRun: args.dryRun,
        delegationStatus,
        warning:
          args.dryRun && !delegationStatus.delegationMatches
            ? "Dry run executed before registrar delegation matched the Route 53 hosted zone."
            : null,
        verificationResult,
        productionLockdownResult,
        hostedSmokeResults,
        steps,
        nextSteps: args.dryRun
          ? [
              "Run this command again without --dry-run after the registrar delegation matches the Route 53 hosted zone.",
            ]
          : [
              "Staging and production custom-domain cutover is finalized.",
              "Repository-connected Amplify CI/CD can still be adopted later without changing the DNS model.",
            ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Hosted-domain cutover finalization failed:", error);
  process.exitCode = 1;
});
