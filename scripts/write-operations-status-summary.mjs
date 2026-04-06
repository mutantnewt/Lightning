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

function summarizeEnvironment(environment) {
  const readiness = environment.alarmSubscriptionReadiness ?? {};
  const health = environment.publicHealth ?? {};
  const alarmStates = Array.isArray(environment.alarmStates)
    ? environment.alarmStates
    : [];
  const alarmsInAlarm = alarmStates.filter((alarm) => alarm.stateValue === "ALARM");
  const lines = [
    `### ${environment.environmentName}`,
    "",
    `- overall status: ${environment.allClear ? "all clear" : "attention needed"}`,
    `- public health: ${health.status ?? "unknown"}${health.finalUrl ? ` (${health.finalUrl})` : ""}`,
    `- alarms in ALARM: ${alarmsInAlarm.length}`,
    `- alarm action coverage: ${environment.alarmActionCoverage?.complete ? "complete" : "incomplete"}`,
    `- confirmed alert destinations: ${readiness.confirmedCount ?? 0}`,
    `- pending alert confirmations: ${readiness.pendingCount ?? 0}`,
    `- alert readiness: ${readiness.ready ? "ready" : "waiting for confirmed destination"}`,
  ];

  if (alarmsInAlarm.length > 0) {
    lines.push(
      `- alarms currently firing: ${alarmsInAlarm.map((alarm) => alarm.alarmName).join(", ")}`,
    );
  }

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = readJson(args.inputPath);
  const environments = Array.isArray(payload.environments) ? payload.environments : [];
  const summaryLines = [
    "## Operations status",
    "",
    `- observed at: ${payload.observedAt ?? "unknown"}`,
    `- region: ${payload.region ?? "unknown"}`,
    `- all clear: ${payload.allClear ? "yes" : "no"}`,
    "",
  ];

  for (const environment of environments) {
    summaryLines.push(summarizeEnvironment(environment), "");
  }

  const summary = summaryLines.join("\n").trim();
  process.stdout.write(`${summary}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
}

main();
