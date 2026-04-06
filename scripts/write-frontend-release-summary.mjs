#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseArgs(argv) {
  const args = {
    releasePath: "",
    statusPath: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--release":
        args.releasePath = next;
        index += 1;
        break;
      case "--status":
        args.statusPath = next;
        index += 1;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!args.releasePath || !args.statusPath) {
    throw new Error("--release and --status are required.");
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(resolve(filePath), "utf8"));
}

function renderChecks(checks) {
  if (!checks) {
    return "- manifest checks: unavailable";
  }

  const interestingChecks = [
    ["environmentMatches", "environment"],
    ["apiBaseUrlMatches", "API base URL"],
    ["siteUrlMatches", "site URL"],
    ["userPoolIdMatches", "user pool ID"],
    ["userPoolClientIdMatches", "user pool client ID"],
    ["moderatorGroupMatches", "moderator group"],
    ["defaultDomainMatches", "default domain"],
  ];

  const failed = interestingChecks
    .filter(([key]) => checks[key] !== true)
    .map(([, label]) => label);

  if (failed.length === 0) {
    return "- manifest checks: all matched expected stack outputs";
  }

  return `- manifest checks: mismatches on ${failed.join(", ")}`;
}

function buildSummary(release, status) {
  const releaseMetadata = release.releaseMetadata ?? {};
  const archivedRelease = release.archivedRelease ?? {};
  const statusRelease = status.release ?? {};
  const checks = status.checks ?? null;
  const lines = [
    "## Frontend release",
    "",
    `- environment: ${release.environment ?? status.environmentName ?? "unknown"}`,
    `- release id: \`${releaseMetadata.releaseId ?? statusRelease.releaseId ?? "unknown"}\``,
    `- commit: \`${releaseMetadata.gitCommitSha ?? statusRelease.gitCommitSha ?? "unknown"}\``,
    `- job id: \`${release.jobId ?? "unknown"}\``,
    `- deploy status: ${release.status ?? "unknown"}`,
    `- hosted URL: ${release.webUrl ?? "unknown"}`,
    `- release manifest URL: ${release.releaseManifestUrl ?? status.releaseUrl ?? "unknown"}`,
    `- archive bucket: ${archivedRelease.remoteStorage?.bucketName ?? "unknown"}`,
    `- archive object: ${archivedRelease.remoteStorage?.archiveKey ?? "unknown"}`,
    `- selected verification target: ${status.selectedTarget ?? "unknown"}`,
    renderChecks(checks),
  ];

  if (status.fallbackReason) {
    lines.push(`- verification fallback: ${status.fallbackReason}`);
  }

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const release = readJson(args.releasePath);
  const status = readJson(args.statusPath);
  const summary = buildSummary(release, status);

  process.stdout.write(`${summary}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
}

main();
