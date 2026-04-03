#!/usr/bin/env node

import {
  deployArchiveToAmplify,
  getFrontendStackNameForEnvironment,
  getStackOutputs,
  releaseManifestFileName,
  resolveArchivedReleaseMetadata,
} from "./amplify-frontend-release-lib.mjs";

function parseArgs(argv) {
  const args = {
    environment: "staging",
    stackName: null,
    releaseId: "",
    region: process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "eu-west-2",
    waitTimeoutMs: 20 * 60 * 1000,
    pollIntervalMs: 10 * 1000,
    requireHostedMatch: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--environment":
        args.environment = next;
        index += 1;
        break;
      case "--stack-name":
        args.stackName = next;
        index += 1;
        break;
      case "--release-id":
        args.releaseId = next;
        index += 1;
        break;
      case "--region":
        args.region = next;
        index += 1;
        break;
      case "--wait-timeout-ms":
        args.waitTimeoutMs = Number(next);
        index += 1;
        break;
      case "--poll-interval-ms":
        args.pollIntervalMs = Number(next);
        index += 1;
        break;
      case "--allow-host-mismatch":
        args.requireHostedMatch = false;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!args.releaseId) {
    throw new Error("--release-id is required.");
  }

  if (!args.stackName) {
    args.stackName = getFrontendStackNameForEnvironment(args.environment);
  }

  return args;
}

function verifyArchiveMatchesTarget(archivedRelease, stackOutputs, stackName) {
  const expectedAppId = stackOutputs.AmplifyAppId ?? null;
  const expectedBranchName = stackOutputs.AmplifyBranchName ?? null;
  const archivedAppId = archivedRelease.hosting?.amplifyAppId ?? null;
  const archivedBranchName = archivedRelease.hosting?.amplifyBranchName ?? null;

  if (
    archivedAppId !== expectedAppId ||
    archivedBranchName !== expectedBranchName
  ) {
    throw new Error(
      [
        `Archived release ${archivedRelease.releaseId} does not match the current hosted target for ${stackName}.`,
        `expected appId=${expectedAppId}, branch=${expectedBranchName}`,
        `archived appId=${archivedAppId}, branch=${archivedBranchName}`,
      ].join(" "),
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stackOutputs = getStackOutputs(args.stackName, args.region);
  const appId = stackOutputs.AmplifyAppId;
  const branchName = stackOutputs.AmplifyBranchName;
  const defaultDomain = stackOutputs.AmplifyDefaultDomain;
  const archivedRelease = resolveArchivedReleaseMetadata({
    environmentName: args.environment,
    releaseId: args.releaseId,
    region: args.region,
    stackName: args.stackName,
  });

  if (!appId || !branchName) {
    throw new Error(
      `Stack ${args.stackName} does not expose AmplifyAppId and AmplifyBranchName. Deploy the frontend hosting stack first.`,
    );
  }

  if (archivedRelease.environmentName !== args.environment) {
    throw new Error(
      `Archived release ${args.releaseId} belongs to ${archivedRelease.environmentName}, not ${args.environment}.`,
    );
  }

  if (args.requireHostedMatch) {
    verifyArchiveMatchesTarget(archivedRelease, stackOutputs, args.stackName);
  }

  const deployment = await deployArchiveToAmplify({
    appId,
    branchName,
    region: args.region,
    archivePath: archivedRelease.archive.archiveZipPath,
    waitTimeoutMs: args.waitTimeoutMs,
    pollIntervalMs: args.pollIntervalMs,
  });

  console.log(
    JSON.stringify(
      {
        environment: args.environment,
        stackName: args.stackName,
        releaseId: args.releaseId,
        archivedRelease,
        redeployJobId: deployment.jobId,
        status: deployment.result.status,
        appId,
        branchName,
        defaultDomain,
        webUrl: defaultDomain ? `https://${branchName}.${defaultDomain}` : null,
        releaseManifestUrl: defaultDomain
          ? `https://${branchName}.${defaultDomain}/${releaseManifestFileName}`
          : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    "Hosted frontend redeploy failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
