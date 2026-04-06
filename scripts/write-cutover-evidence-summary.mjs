#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseArgs(argv) {
  const args = {
    inputPath: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--input":
        args.inputPath = next;
        index += 1;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!args.inputPath) {
    throw new Error("--input is required.");
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(resolve(filePath), "utf8"));
}

function formatDnsNameservers(delegationStatus) {
  const expected = Array.isArray(delegationStatus?.expectedNameservers)
    ? delegationStatus.expectedNameservers
    : [];
  const current = Array.isArray(delegationStatus?.currentNameservers)
    ? delegationStatus.currentNameservers
    : [];

  return {
    expected: expected.length > 0 ? expected.join(", ") : "unknown",
    current: current.length > 0 ? current.join(", ") : "unknown",
  };
}

function summarizeEnvironment(environment) {
  const https = environment.https ?? {};
  const amplify = environment.amplify ?? {};
  const temporaryOrigins = environment.temporaryOrigins ?? {};
  const redirectAliases = Array.isArray(https.redirectAliases) ? https.redirectAliases : [];
  const redirectStatus =
    redirectAliases.length === 0
      ? "none configured"
      : redirectAliases.every((alias) => alias.redirectsToCanonical === true)
        ? "all redirecting to canonical domain"
        : "one or more aliases not redirecting cleanly";

  return [
    `### ${environment.environmentName}`,
    "",
    `- custom domain: ${environment.customDomainUrl ?? "unknown"}`,
    `- custom domain ready: ${environment.customDomainReady ? "yes" : "no"}`,
    `- custom domain HTTPS: ${https.customDomainRoot?.status ?? "unknown"}`,
    `- favicon HTTPS: ${https.customDomainFavicon?.status ?? "unknown"}`,
    `- redirect aliases: ${redirectStatus}`,
    `- hosted smoke: ${environment.hostedSmoke?.status ?? "skipped"}`,
    `- localhost temporary origin present: ${temporaryOrigins.localhost5175Present ? "yes" : "no"}`,
    `- hosted Amplify temporary origin present: ${temporaryOrigins.hostedAmplifyOriginPresent ? "yes" : "no"}`,
    `- domain association status: ${amplify.domainAssociation?.domainStatus ?? "unknown"}`,
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = readJson(args.inputPath);
  const delegation = formatDnsNameservers(payload.delegationStatus);
  const environments = Array.isArray(payload.environments) ? payload.environments : [];
  const summaryLines = [
    "## Cutover evidence",
    "",
    `- observed at: ${payload.observedAt ?? "unknown"}`,
    `- domain: ${payload.domainName ?? "unknown"}`,
    `- region: ${payload.region ?? "unknown"}`,
    `- go-live ready: ${payload.goLiveReady ? "yes" : "no"}`,
    `- Route 53 delegation matches: ${payload.delegationStatus?.delegationMatches ? "yes" : "no"}`,
    `- expected nameservers: ${delegation.expected}`,
    `- current nameservers: ${delegation.current}`,
    "",
  ];

  for (const environment of environments) {
    summaryLines.push(summarizeEnvironment(environment), "");
  }

  const nextSteps = Array.isArray(payload.nextSteps) ? payload.nextSteps : [];
  if (nextSteps.length > 0) {
    summaryLines.push("### Next steps", "");
    for (const step of nextSteps) {
      summaryLines.push(`- ${step}`);
    }
  }

  const summary = summaryLines.join("\n").trim();
  process.stdout.write(`${summary}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
}

main();
