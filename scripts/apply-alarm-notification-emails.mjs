#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { defaultRegion, infraDir, npmCli, repoRoot, run } from "./domain-cutover-lib.mjs";

const nodeBin = process.execPath;
const operationsStatusScript = fileURLToPath(
  new URL("./print-operations-status.mjs", import.meta.url),
);

function parseArgs(argv) {
  const args = {
    environmentName: "all",
    region: defaultRegion,
    emails: "",
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--environment":
        args.environmentName = next;
        index += 1;
        break;
      case "--region":
        args.region = next;
        index += 1;
        break;
      case "--emails":
        args.emails = next;
        index += 1;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!["staging", "production", "all"].includes(args.environmentName)) {
    throw new Error("--environment must be one of: staging, production, all.");
  }

  return args;
}

function parseEmailList(value) {
  return [...new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  )];
}

function buildEnvironmentPlan(environmentName) {
  return {
    environmentName,
    deployScript:
      environmentName === "staging" ? "deploy:staging" : "deploy:production",
    statusArgs: [
      operationsStatusScript,
      "--environment",
      environmentName,
    ],
  };
}

function runInherited(command, commandArgs, options = {}) {
  run(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    stdio: "inherit",
    env: options.env ?? {},
  });
}

function runJson(command, commandArgs, options = {}) {
  const raw = run(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? {},
  });

  return JSON.parse(raw);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const resolvedEmails = parseEmailList(
    args.emails || process.env.LIGHTNING_ALARM_NOTIFICATION_EMAILS || "",
  );

  if (resolvedEmails.length === 0) {
    throw new Error(
      "Provide alarm email destinations with --emails or LIGHTNING_ALARM_NOTIFICATION_EMAILS.",
    );
  }

  const environmentNames =
    args.environmentName === "all"
      ? ["staging", "production"]
      : [args.environmentName];
  const plan = environmentNames.map(buildEnvironmentPlan);
  const emailCsv = resolvedEmails.join(",");
  const sharedEnv = {
    LIGHTNING_ALARM_NOTIFICATION_EMAILS: emailCsv,
    AWS_REGION: args.region,
    AWS_DEFAULT_REGION: args.region,
  };

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          observedAt: new Date().toISOString(),
          dryRun: true,
          region: args.region,
          emails: resolvedEmails,
          note:
            "SNS email subscriptions remain PendingConfirmation until each recipient confirms the subscription email.",
          plan: plan.map((entry) => ({
            ...entry,
            cwd: infraDir,
            deployCommand: [npmCli, "run", entry.deployScript].join(" "),
            statusCommand: [nodeBin, ...entry.statusArgs].join(" "),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const results = [];

  for (const entry of plan) {
    runInherited(npmCli, ["run", entry.deployScript], {
      cwd: infraDir,
      env: sharedEnv,
    });

    const status = runJson(
      nodeBin,
      entry.statusArgs,
      {
        cwd: infraDir,
        env: sharedEnv,
      },
    );

    results.push({
      environmentName: entry.environmentName,
      deployScript: entry.deployScript,
      statusCommand: [nodeBin, ...entry.statusArgs].join(" "),
      status,
    });
  }

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        dryRun: false,
        region: args.region,
        emails: resolvedEmails,
        note:
          "If alarmTopicSubscriptions contains PendingConfirmation entries, confirm the SNS email from the destination mailbox and rerun ops:status.",
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Applying alarm notification emails failed:", error);
  process.exitCode = 1;
});
