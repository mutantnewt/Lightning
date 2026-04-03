#!/usr/bin/env node

import {
  listArchivedReleases,
  listRemoteArchivedReleases,
} from "./amplify-frontend-release-lib.mjs";

function parseArgs(argv) {
  const args = {
    environment: "all",
    region: process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "eu-west-2",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--environment":
        args.environment = next;
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

  if (!["all", "staging", "production"].includes(args.environment)) {
    throw new Error("--environment must be one of: all, staging, production.");
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const localReleases = listArchivedReleases({
    environmentName: args.environment,
  });
  const remoteReleases = listRemoteArchivedReleases({
    environmentName: args.environment,
    region: args.region,
  });
  const localReleaseIds = new Set(
    localReleases.map(
      (release) => `${release.environmentName}:${release.releaseId}`,
    ),
  );
  const mergedReleases = [
    ...localReleases.map((release) => ({
      ...release,
      storagePresence: {
        local: true,
        remote: Boolean(release.remoteArchive),
      },
    })),
    ...remoteReleases
      .filter(
        (release) =>
          !localReleaseIds.has(`${release.environmentName}:${release.releaseId}`),
      )
      .map((release) => ({
        ...release,
        storagePresence: {
          local: false,
          remote: true,
        },
      })),
  ];
  const releases = mergedReleases.map((release) => ({
    releaseId: release.releaseId,
    environmentName: release.environmentName,
    builtAt: release.builtAt,
    sourceVersionShort: release.build?.sourceVersionShort ?? null,
    sourceBranch: release.build?.sourceBranch ?? null,
    sourceDirty: release.build?.sourceDirty ?? null,
    amplifyJobId: release.hosting?.amplifyJobId ?? null,
    amplifyWebUrl: release.hosting?.amplifyWebUrl ?? null,
    archiveZipPath: release.archive?.archiveZipPath ?? null,
    archiveZipSha256: release.archive?.archiveZipSha256 ?? null,
    archivedAt: release.archive?.archivedAt ?? null,
    remoteBucketName: release.remoteArchive?.bucketName ?? null,
    remoteZipObjectKey: release.remoteArchive?.zipObjectKey ?? null,
    remoteMetadataObjectKey: release.remoteArchive?.metadataObjectKey ?? null,
    remoteUploadedAt: release.remoteArchive?.uploadedAt ?? null,
    storagePresence: release.storagePresence,
  }));

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        environmentName: args.environment,
        region: args.region,
        count: releases.length,
        releases,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    "Hosted frontend archive listing failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
