#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import {
  awsCli,
  defaultRegion,
  getStackOutputs,
  repoRoot,
  run,
} from "./domain-cutover-lib.mjs";

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

function getStackName(environmentName) {
  return environmentName === "staging"
    ? "LightningStagingStack"
    : "LightningProductionStack";
}

function listTopicSubscriptions(topicArn, region) {
  const subscriptions = [];
  let nextToken = null;

  do {
    const commandArgs = [
      "sns",
      "list-subscriptions-by-topic",
      "--topic-arn",
      topicArn,
      "--region",
      region,
    ];

    if (nextToken) {
      commandArgs.push("--next-token", nextToken);
    }

    const raw = run(awsCli, commandArgs, {
      cwd: repoRoot,
    });
    const parsed = JSON.parse(raw);

    subscriptions.push(
      ...(parsed.Subscriptions ?? []).map((subscription) => ({
        protocol: subscription.Protocol ?? null,
        endpoint: subscription.Endpoint ?? null,
        endpointNormalized: (subscription.Endpoint ?? "")
          .trim()
          .toLowerCase(),
        subscriptionArn: subscription.SubscriptionArn ?? null,
        deleted: subscription.SubscriptionArn === "Deleted",
        pendingConfirmation:
          subscription.SubscriptionArn === "PendingConfirmation",
      })),
    );

    nextToken = parsed.NextToken ?? null;
  } while (nextToken);

  return subscriptions;
}

function subscribeEmail(topicArn, email, region) {
  const raw = run(awsCli, [
    "sns",
    "subscribe",
    "--topic-arn",
    topicArn,
    "--protocol",
    "email",
    "--notification-endpoint",
    email,
    "--return-subscription-arn",
    "--region",
    region,
  ], {
    cwd: repoRoot,
  });

  return JSON.parse(raw);
}

function getEnvironmentPlan(environmentName, region, emails) {
  const stackName = getStackName(environmentName);
  const outputs = getStackOutputs(stackName, region);
  const topicArn = outputs.OperationsAlarmTopicArn ?? null;
  const topicName = outputs.OperationsAlarmTopicName ?? null;

  if (!topicArn) {
    throw new Error(
      `Stack ${stackName} does not expose OperationsAlarmTopicArn.`,
    );
  }

  const existingSubscriptions = listTopicSubscriptions(topicArn, region);
  const plannedEmails = emails.map((email) => {
    const existingSubscription =
      existingSubscriptions.find(
        (subscription) =>
          subscription.protocol === "email" &&
          subscription.endpointNormalized === email &&
          !subscription.deleted,
      ) ?? null;

    return {
      email,
      existingSubscription,
      action: existingSubscription ? "skip-existing" : "subscribe",
    };
  });

  return {
    environmentName,
    stackName,
    topicArn,
    topicName,
    plannedEmails,
  };
}

function getEnvironmentStatus(environmentName, region) {
  const raw = run(nodeBin, [
    operationsStatusScript,
    "--environment",
    environmentName,
    "--region",
    region,
  ], {
    cwd: repoRoot,
  });
  const parsed = JSON.parse(raw);

  return parsed.environments?.[0] ?? null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const emails = parseEmailList(
    args.emails || process.env.LIGHTNING_ALARM_NOTIFICATION_EMAILS || "",
  );

  if (emails.length === 0) {
    throw new Error(
      "Provide alarm email destinations with --emails or LIGHTNING_ALARM_NOTIFICATION_EMAILS.",
    );
  }

  const environmentNames =
    args.environmentName === "all"
      ? ["staging", "production"]
      : [args.environmentName];

  const plans = environmentNames.map((environmentName) =>
    getEnvironmentPlan(environmentName, args.region, emails),
  );

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          observedAt: new Date().toISOString(),
          dryRun: true,
          region: args.region,
          emails,
          note:
            "Direct SNS subscription attaches recipients without a CDK deploy. Confirm each SNS email before expecting alarmSubscriptionReadiness.ready to become true.",
          plans: plans.map((plan) => ({
            ...plan,
            status: getEnvironmentStatus(plan.environmentName, args.region),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const results = [];

  for (const plan of plans) {
    const subscriptionResults = [];

    for (const entry of plan.plannedEmails) {
      if (entry.action === "skip-existing") {
        subscriptionResults.push({
          email: entry.email,
          action: entry.action,
          subscriptionArn: entry.existingSubscription?.subscriptionArn ?? null,
          pendingConfirmation:
            entry.existingSubscription?.pendingConfirmation ?? false,
        });
        continue;
      }

      const response = subscribeEmail(plan.topicArn, entry.email, args.region);

      subscriptionResults.push({
        email: entry.email,
        action: entry.action,
        subscriptionArn: response.SubscriptionArn ?? null,
        pendingConfirmation:
          response.SubscriptionArn === "PendingConfirmation",
      });
    }

    results.push({
      environmentName: plan.environmentName,
      stackName: plan.stackName,
      topicArn: plan.topicArn,
      topicName: plan.topicName,
      subscriptionResults,
      status: getEnvironmentStatus(plan.environmentName, args.region),
    });
  }

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        dryRun: false,
        region: args.region,
        emails,
        note:
          "If subscriptionResults contains PendingConfirmation, confirm each SNS email and rerun npm run ops:status.",
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Direct alarm email subscription failed:", error);
  process.exitCode = 1;
});
