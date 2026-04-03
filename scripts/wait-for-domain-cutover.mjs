#!/usr/bin/env node

import path from "node:path";
import {
  defaultRegion,
  getDelegationStatus,
  lightningDnsStackName,
  lightningRootDomainName,
  repoRoot,
  run,
  sleep,
} from "./domain-cutover-lib.mjs";

const nodeBin = process.env.NODE_BIN ?? process.execPath;
const finalizerScript = path.join(
  repoRoot,
  "scripts",
  "finalize-hosted-domain-cutover.mjs",
);

function parseArgs(argv) {
  const args = {
    domainName: lightningRootDomainName,
    dnsStackName: lightningDnsStackName,
    region: defaultRegion,
    timeoutMs: 24 * 60 * 60 * 1000,
    pollIntervalMs: 60 * 1000,
    runFinalizer: false,
    runHostedSmoke: false,
    requireHostedSmoke: false,
    deploymentMode: "MANUAL",
    accessToken: process.env.AMPLIFY_ACCESS_TOKEN ?? "",
    customCertificateArn: process.env.AMPLIFY_CUSTOM_CERTIFICATE_ARN ?? "",
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
      case "--timeout-ms":
        args.timeoutMs = Number(next);
        index += 1;
        break;
      case "--poll-interval-ms":
        args.pollIntervalMs = Number(next);
        index += 1;
        break;
      case "--run-finalizer":
        args.runFinalizer = true;
        break;
      case "--run-hosted-smoke":
        args.runFinalizer = true;
        args.runHostedSmoke = true;
        break;
      case "--require-hosted-smoke":
        args.runFinalizer = true;
        args.runHostedSmoke = true;
        args.requireHostedSmoke = true;
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
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 0) {
    throw new Error("--timeout-ms must be a non-negative number.");
  }

  if (!Number.isFinite(args.pollIntervalMs) || args.pollIntervalMs <= 0) {
    throw new Error("--poll-interval-ms must be a positive number.");
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

function buildFinalizerArgs(args) {
  const finalizerArgs = [
    finalizerScript,
    "--domain",
    args.domainName,
    "--dns-stack-name",
    args.dnsStackName,
    "--region",
    args.region,
    "--deployment-mode",
    args.deploymentMode,
  ];

  if (args.runHostedSmoke) {
    finalizerArgs.push("--run-hosted-smoke");
  }

  if (args.requireHostedSmoke) {
    finalizerArgs.push("--require-hosted-smoke");
  }

  if (args.accessToken) {
    finalizerArgs.push("--access-token", args.accessToken);
  }

  if (args.customCertificateArn) {
    finalizerArgs.push("--custom-certificate-arn", args.customCertificateArn);
  }

  return finalizerArgs;
}

function printAttempt({ attempt, elapsedMs, status, pollIntervalMs }) {
  const currentNameServers =
    status.currentNameServers.length > 0
      ? status.currentNameServers.join(", ")
      : "(none resolved)";

  const nextPollAt = new Date(Date.now() + pollIntervalMs).toISOString();

  console.log(
    JSON.stringify(
      {
        attempt,
        observedAt: status.observedAt,
        elapsedMs,
        delegationMatches: status.delegationMatches,
        currentNameServers,
        expectedNameServers: status.expectedNameServers,
        resolutionError: status.resolutionError,
        nextPollAt: status.delegationMatches ? null : nextPollAt,
      },
      null,
      2,
    ),
  );
}

function printSummary(summary) {
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAtMs = Date.now();
  const finalizerArgs = buildFinalizerArgs(args);

  if (args.dryRun) {
    const status = await getDelegationStatus({
      domainName: args.domainName,
      dnsStackName: args.dnsStackName,
      region: args.region,
    });

    printSummary({
      observedAt: new Date().toISOString(),
      mode: "dry-run",
      domainName: args.domainName,
      timeoutMs: args.timeoutMs,
      pollIntervalMs: args.pollIntervalMs,
      runFinalizer: args.runFinalizer,
      runHostedSmoke: args.runHostedSmoke,
      currentStatus: status,
      plannedFinalizerCommand: args.runFinalizer
        ? [nodeBin, ...finalizerArgs].join(" ")
        : null,
      nextStep: status.delegationMatches
        ? "Delegation already matches. Run the finalizer path or remove --dry-run."
        : "Wait for the registrar delegation to switch to the Route 53 nameservers, or rerun without --dry-run to poll automatically.",
    });
    return;
  }

  let attempt = 0;
  let latestStatus = null;

  while (Date.now() - startedAtMs <= args.timeoutMs) {
    attempt += 1;
    latestStatus = await getDelegationStatus({
      domainName: args.domainName,
      dnsStackName: args.dnsStackName,
      region: args.region,
    });

    printAttempt({
      attempt,
      elapsedMs: Date.now() - startedAtMs,
      status: latestStatus,
      pollIntervalMs: args.pollIntervalMs,
    });

    if (latestStatus.delegationMatches) {
      let finalizerResult = null;

      if (args.runFinalizer) {
        run(nodeBin, finalizerArgs, {
          cwd: repoRoot,
          stdio: "inherit",
        });
        finalizerResult = {
          status: "completed",
          command: [nodeBin, ...finalizerArgs].join(" "),
        };
      }

      printSummary({
        observedAt: new Date().toISOString(),
        domainName: args.domainName,
        attempts: attempt,
        elapsedMs: Date.now() - startedAtMs,
        delegationMatches: true,
        finalizer: finalizerResult,
        nextStep: args.runFinalizer
          ? "Cutover watcher completed successfully."
          : "Delegation is ready. Run the finalizer when you want to attach domains and lock down production CORS.",
      });
      return;
    }

    const nextElapsedMs = Date.now() - startedAtMs + args.pollIntervalMs;

    if (nextElapsedMs > args.timeoutMs) {
      break;
    }

    await sleep(args.pollIntervalMs);
  }

  printSummary({
    observedAt: new Date().toISOString(),
    domainName: args.domainName,
    attempts: attempt,
    elapsedMs: Date.now() - startedAtMs,
    delegationMatches: false,
    latestStatus,
    nextStep:
      "Registrar delegation is still not ready. Keep the Route 53 nameservers configured at the registrar and rerun this watcher.",
  });

  process.exitCode = 1;
}

main().catch((error) => {
  console.error("Domain cutover watcher failed:", error);
  process.exitCode = 1;
});
