#!/usr/bin/env node

import path from "node:path";
import {
  defaultRegion,
  lightningDnsStackName,
  lightningRootDomainName,
  repoRoot,
  run,
} from "./domain-cutover-lib.mjs";

const nodeBin = process.env.NODE_BIN ?? process.execPath;
const waitScript = path.join(
  repoRoot,
  "scripts",
  "wait-for-domain-cutover.mjs",
);
const evidenceScript = path.join(
  repoRoot,
  "scripts",
  "capture-cutover-evidence.mjs",
);

function parseArgs(argv) {
  const args = {
    domainName: lightningRootDomainName,
    dnsStackName: lightningDnsStackName,
    region: defaultRegion,
    timeoutMs: 24 * 60 * 60 * 1000,
    pollIntervalMs: 60 * 1000,
    deploymentMode: "MANUAL",
    accessToken: process.env.AMPLIFY_ACCESS_TOKEN ?? "",
    customCertificateArn: process.env.AMPLIFY_CUSTOM_CERTIFICATE_ARN ?? "",
    runHostedSmoke: false,
    requireHostedSmoke: false,
    evidenceOutputPath: "",
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
      case "--run-hosted-smoke":
        args.runHostedSmoke = true;
        break;
      case "--require-hosted-smoke":
        args.runHostedSmoke = true;
        args.requireHostedSmoke = true;
        break;
      case "--evidence-output":
        args.evidenceOutputPath = next;
        index += 1;
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

function buildWaitArgs(args) {
  const waitArgs = [
    waitScript,
    "--domain",
    args.domainName,
    "--dns-stack-name",
    args.dnsStackName,
    "--region",
    args.region,
    "--timeout-ms",
    String(args.timeoutMs),
    "--poll-interval-ms",
    String(args.pollIntervalMs),
    "--deployment-mode",
    args.deploymentMode,
  ];

  if (args.runHostedSmoke) {
    waitArgs.push("--run-hosted-smoke");
  } else {
    waitArgs.push("--run-finalizer");
  }

  if (args.requireHostedSmoke) {
    waitArgs.push("--require-hosted-smoke");
  }

  if (args.accessToken) {
    waitArgs.push("--access-token", args.accessToken);
  }

  if (args.customCertificateArn) {
    waitArgs.push("--custom-certificate-arn", args.customCertificateArn);
  }

  if (args.dryRun) {
    waitArgs.push("--dry-run");
  }

  return waitArgs;
}

function buildEvidenceArgs(args) {
  const evidenceArgs = [
    evidenceScript,
    "--environment",
    "all",
    "--domain",
    args.domainName,
    "--dns-stack-name",
    args.dnsStackName,
    "--region",
    args.region,
  ];

  if (args.evidenceOutputPath) {
    evidenceArgs.push("--output", args.evidenceOutputPath);
  }

  return evidenceArgs;
}

function runInherited(command, commandArgs) {
  run(command, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const waitArgs = buildWaitArgs(args);
  const evidenceArgs = buildEvidenceArgs(args);

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          observedAt: new Date().toISOString(),
          mode: "dry-run",
          waitCommand: [nodeBin, ...waitArgs].join(" "),
          evidenceCommand: [nodeBin, ...evidenceArgs].join(" "),
          nextStep:
            "Remove --dry-run once the registrar nameservers are pointed at Route 53 and you want the full cutover plus evidence flow to execute.",
        },
        null,
        2,
      ),
    );
    return;
  }

  runInherited(nodeBin, waitArgs);
  runInherited(nodeBin, evidenceArgs);

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        status: "completed",
        waitCommand: [nodeBin, ...waitArgs].join(" "),
        evidenceCommand: [nodeBin, ...evidenceArgs].join(" "),
        nextStep:
          "Domain cutover completed and the evidence snapshot has been captured.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Domain cutover completion failed:", error);
  process.exitCode = 1;
});
