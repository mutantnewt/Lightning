#!/usr/bin/env node

import { awsCli, defaultRegion, getStackOutputs, run } from "./domain-cutover-lib.mjs";

function parseArgs(argv) {
  const args = {
    environmentName: "all",
    region: defaultRegion,
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
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!["staging", "production", "all"].includes(args.environmentName)) {
    throw new Error("--environment must be one of: staging, production, all.");
  }

  return args;
}

function getStackName(environmentName) {
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

function getHttpStatus(url) {
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
      finalUrl,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      finalUrl: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getAlarmStates(alarmNames, region) {
  if (alarmNames.length === 0) {
    return [];
  }

  const raw = run(awsCli, [
    "cloudwatch",
    "describe-alarms",
    "--alarm-names",
    ...alarmNames,
    "--region",
    region,
  ]);
  const parsed = JSON.parse(raw);

  return (parsed.MetricAlarms ?? []).map((alarm) => ({
    alarmName: alarm.AlarmName,
    stateValue: alarm.StateValue,
    stateReason: alarm.StateReason,
    alarmActions: alarm.AlarmActions ?? [],
  }));
}

function getTopicSubscriptions(topicArn, region) {
  if (!topicArn) {
    return [];
  }

  const raw = run(awsCli, [
    "sns",
    "list-subscriptions-by-topic",
    "--topic-arn",
    topicArn,
    "--region",
    region,
  ]);
  const parsed = JSON.parse(raw);

  return (parsed.Subscriptions ?? []).map((subscription) => ({
    protocol: subscription.Protocol ?? null,
    endpoint: subscription.Endpoint ?? null,
    subscriptionArn: subscription.SubscriptionArn ?? null,
    pendingConfirmation: subscription.SubscriptionArn === "PendingConfirmation",
  }));
}

function buildDashboardUrl(dashboardName, region) {
  if (!dashboardName) {
    return null;
  }

  return `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#dashboards:name=${encodeURIComponent(dashboardName)}`;
}

function collectEnvironmentStatus(environmentName, region) {
  const stackName = getStackName(environmentName);
  const outputs = getStackOutputs(stackName, region);
  const alarmNames = splitCsv(outputs.OperationsAlarmNames);
  const alarmStates = getAlarmStates(alarmNames, region);
  const dashboardName = outputs.OperationsDashboardName ?? null;
  const alarmTopicArn = outputs.OperationsAlarmTopicArn ?? null;
  const alarmTopicName = outputs.OperationsAlarmTopicName ?? null;
  const configuredAlarmNotificationEmailCount = Number(
    outputs.OperationsAlarmNotificationEmailCount ?? "0",
  );
  const publicHealthUrl = `${outputs.HttpApiUrl}/public/health`;
  const publicHealth = getHttpStatus(publicHealthUrl);
  const alarmsInAlarmState = alarmStates.filter(
    (alarm) => alarm.stateValue === "ALARM",
  );
  const alarmsMissingAction =
    alarmTopicArn === null
      ? []
      : alarmStates.filter((alarm) => !alarm.alarmActions.includes(alarmTopicArn));
  const alarmActionCoverage =
    alarmTopicArn === null
      ? null
      : {
          expectedAlarmTopicArn: alarmTopicArn,
          complete: alarmsMissingAction.length === 0,
          alarmsMissingAction: alarmsMissingAction.map((alarm) => alarm.alarmName),
        };
  const alarmTopicSubscriptions = getTopicSubscriptions(alarmTopicArn, region);
  const confirmedSubscriptions = alarmTopicSubscriptions.filter(
    (subscription) =>
      !subscription.pendingConfirmation &&
      subscription.subscriptionArn &&
      subscription.subscriptionArn !== "Deleted",
  );
  const pendingSubscriptions = alarmTopicSubscriptions.filter(
    (subscription) => subscription.pendingConfirmation,
  );
  const alarmSubscriptionReadiness = {
    configuredEmailCount: Number.isFinite(configuredAlarmNotificationEmailCount)
      ? configuredAlarmNotificationEmailCount
      : 0,
    confirmedCount: confirmedSubscriptions.length,
    pendingCount: pendingSubscriptions.length,
    totalCount: alarmTopicSubscriptions.length,
    ready:
      !Number.isFinite(configuredAlarmNotificationEmailCount) ||
      configuredAlarmNotificationEmailCount === 0
        ? true
        : confirmedSubscriptions.length >= configuredAlarmNotificationEmailCount,
  };
  const allClear =
    publicHealth.ok &&
    alarmsInAlarmState.length === 0 &&
    (alarmActionCoverage?.complete ?? true) &&
    alarmSubscriptionReadiness.ready;

  return {
    environmentName,
    stackName,
    dashboardName,
    dashboardUrl: buildDashboardUrl(dashboardName, region),
    apiAccessLogGroupName: outputs.ApiAccessLogGroupName ?? null,
    alarmTopicArn,
    alarmTopicName,
    publicHealthUrl,
    publicHealth,
    alarmStates,
    alarmActionCoverage,
    alarmTopicSubscriptions,
    alarmSubscriptionReadiness,
    allClear,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const environmentNames =
    args.environmentName === "all"
      ? ["staging", "production"]
      : [args.environmentName];
  const environments = environmentNames.map((environmentName) =>
    collectEnvironmentStatus(environmentName, args.region),
  );

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        region: args.region,
        environments,
        allClear: environments.every((environment) => environment.allClear),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Operations status report failed:", error);
  process.exitCode = 1;
});
