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

function getEntries(payload) {
  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  if (Array.isArray(payload.plans)) {
    return payload.plans;
  }

  return [];
}

function getActionCounts(entry) {
  const items = Array.isArray(entry.subscriptionResults)
    ? entry.subscriptionResults
    : Array.isArray(entry.plannedEmails)
      ? entry.plannedEmails
      : [];

  return items.reduce(
    (counts, item) => {
      const action = item.action ?? "unknown";
      counts[action] = (counts[action] ?? 0) + 1;
      return counts;
    },
    {},
  );
}

function buildEnvironmentLines(entry) {
  const readiness = entry.status?.alarmSubscriptionReadiness ?? null;
  const counts = getActionCounts(entry);
  const lines = [
    `### ${entry.environmentName}`,
    "",
    `- topic: \`${entry.topicName ?? "unknown"}\``,
    `- confirmed subscriptions: ${readiness?.confirmedCount ?? 0}`,
    `- pending confirmations: ${readiness?.pendingCount ?? 0}`,
    `- readiness: ${readiness?.ready ? "ready" : "waiting for confirmation"}`,
    `- planned or applied actions: ${Object.entries(counts)
      .map(([action, count]) => `${action}=${count}`)
      .join(", ") || "none"}`,
  ];

  if (!readiness?.ready) {
    lines.push("- next action: confirm the SNS email subscription, then rerun `npm run ops:status`");
  }

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(readFileSync(resolve(args.inputPath), "utf8"));
  const entries = getEntries(payload);
  const modeLabel = payload.dryRun ? "Dry run" : "Live apply";
  const heading = `## Alarm subscriptions: ${modeLabel}`;
  const blocks = [
    heading,
    "",
    `- observed at: ${payload.observedAt ?? "unknown"}`,
    `- region: ${payload.region ?? "unknown"}`,
    `- emails: ${(payload.emails ?? []).join(", ") || "none"}`,
    "",
  ];

  for (const entry of entries) {
    blocks.push(buildEnvironmentLines(entry), "");
  }

  const summary = blocks.join("\n").trim();
  process.stdout.write(`${summary}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
}

main();
